/**
 * chatbot.service.js
 * 
 * AI-powered fleet management chatbot.
 * Uses Claude (Anthropic) with live fleet data as context.
 * 
 * Handles questions like:
 *   "Which vehicles are speeding right now?"
 *   "How much fuel did truck T123ABC use this week?"
 *   "Show me all alarms from yesterday"
 *   "Which driver had the most incidents last month?"
 *   "Is vehicle KDA123 online?"
 *   "What's the total fleet mileage today?"
 */

const Anthropic = require('@anthropic-ai/sdk');
const cms       = require('../services/cmsv6.service');
const logger    = require('../utils/logger');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL     = process.env.CHATBOT_MODEL || 'claude-haiku-4-5-20251001';
const COMPANY   = process.env.COMPANY_NAME  || 'Your Company';

// ── System Prompt ───────────────────────────────────────────────────────────

function buildSystemPrompt(fleetContext) {
  return `You are FleetBot, the AI fleet management assistant for ${COMPANY}.
You have real-time access to the company's fleet of ${fleetContext.totals?.vehicles || '100+'} vehicles 
equipped with GPS trackers, cameras, and fuel sensors.

CURRENT FLEET STATUS (live data as of ${new Date().toISOString()}):
${JSON.stringify(fleetContext, null, 2)}

YOUR CAPABILITIES:
- Answer questions about live vehicle locations, speeds, and status
- Report on fuel consumption, levels, and anomalies (theft/drain detection)
- Summarize alarm and incident data
- Provide driving behaviour analysis (harsh braking, overspeed, fatigue)
- Report on mileage and utilization
- Identify vehicles that need attention
- Answer questions about camera feeds and recordings

RESPONSE STYLE:
- Be concise and direct
- Use numbers and specific vehicle plates when available
- Flag urgent issues (active alarms, speeding vehicles) prominently
- Format data clearly using bullet points or tables for lists
- For data not available in the context, explain what report to pull
- Never make up vehicle data — only use the provided context

If the user asks for something beyond the current snapshot (like historical reports),
explain that they need to specify a date range and you can fetch it.`;
}

// ── Tool Definitions (Claude function calling) ─────────────────────────────

const tools = [
  {
    name: 'get_fleet_snapshot',
    description: 'Get real-time status of the entire fleet: online/offline counts, active alarms, speeding vehicles',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_vehicle_status',
    description: 'Get current GPS, speed, fuel level and status of a specific vehicle',
    input_schema: {
      type: 'object',
      properties: {
        vehicle_id: { type: 'string', description: 'Vehicle device ID or plate number' },
      },
      required: ['vehicle_id'],
    },
  },
  {
    name: 'get_alarms',
    description: 'Get alarm/incident records for a date range, optionally filtered by vehicle or alarm type',
    input_schema: {
      type: 'object',
      properties: {
        date:      { type: 'string', description: 'Date YYYY-MM-DD (uses today if not specified)' },
        vehicle_id:{ type: 'string', description: 'Filter by vehicle ID or plate (optional)' },
        alarm_type:{ type: 'string', description: 'Filter by alarm type code (optional)' },
      },
      required: [],
    },
  },
  {
    name: 'get_fuel_report',
    description: 'Get fuel consumption, refuelling events, and anomaly data for a vehicle',
    input_schema: {
      type: 'object',
      properties: {
        vehicle_id:  { type: 'string', description: 'Vehicle device ID' },
        date:        { type: 'string', description: 'Date YYYY-MM-DD' },
        report_type: { type: 'string', enum: ['summary', 'dynamic', 'abnormal'], description: 'Type of fuel report' },
      },
      required: ['vehicle_id'],
    },
  },
  {
    name: 'get_mileage_report',
    description: 'Get mileage/distance travelled for a vehicle on a specific date',
    input_schema: {
      type: 'object',
      properties: {
        vehicle_id: { type: 'string', description: 'Vehicle device ID' },
        date:       { type: 'string', description: 'Date YYYY-MM-DD (default: today)' },
      },
      required: ['vehicle_id'],
    },
  },
  {
    name: 'get_daily_summary',
    description: 'Get a full daily operations summary for the whole fleet: alarms, top offenders, activity',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date YYYY-MM-DD (default: today)' },
      },
      required: [],
    },
  },
];

// ── Tool Executor ───────────────────────────────────────────────────────────

async function executeTool(name, input) {
  const today = new Date().toISOString().slice(0, 10);

  switch (name) {
    case 'get_fleet_snapshot':
      return await cms.getFleetSnapshot();

    case 'get_vehicle_status': {
      const { vehicle_id } = input;
      const [gps, fuel] = await Promise.allSettled([
        cms.getVehicleGPS(vehicle_id),
        cms.getFuelLevel(vehicle_id),
      ]);
      return {
        vehicle_id,
        gps:  gps.status  === 'fulfilled' ? gps.value  : 'unavailable',
        fuel: fuel.status === 'fulfilled' ? fuel.value : 'no fuel sensor / unavailable',
      };
    }

    case 'get_alarms': {
      const date = input.date || today;
      return await cms.getAlarms({
        devIdno:   input.vehicle_id || '',
        begintime: `${date} 00:00:00`,
        endtime:   `${date} 23:59:59`,
        alarmType: input.alarm_type || '',
        pageSize:  200,
      });
    }

    case 'get_fuel_report': {
      const date = input.date || today;
      return await cms.getFuelReport(
        input.vehicle_id,
        `${date} 00:00:00`,
        `${date} 23:59:59`,
        input.report_type || 'summary'
      );
    }

    case 'get_mileage_report': {
      const date = input.date || today;
      return await cms.getMileageReport(
        input.vehicle_id,
        `${date} 00:00:00`,
        `${date} 23:59:59`
      );
    }

    case 'get_daily_summary':
      return await cms.getDailySummary(input.date || today);

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── Main Chat Function ──────────────────────────────────────────────────────

/**
 * Process a user message and return AI response with fleet data
 * @param {string} message — user's question
 * @param {Array}  history — conversation history [{role, content}]
 * @returns {{ reply: string, toolsUsed: string[], tokensUsed: number }}
 */
async function chat(message, history = []) {
  // Get live fleet context for system prompt
  let fleetContext = {};
  try {
    fleetContext = await cms.getFleetSnapshot();
  } catch (e) {
    logger.warn('[Chatbot] Could not load fleet context:', e.message);
    fleetContext = { error: 'Fleet data temporarily unavailable', message: e.message };
  }

  const messages = [
    ...history,
    { role: 'user', content: message },
  ];

  const toolsUsed = [];
  let response;

  // Agentic loop — Claude may call tools multiple times
  let iterations = 0;
  const maxIter  = 5;

  while (iterations < maxIter) {
    iterations++;

    response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 1500,
      system:     buildSystemPrompt(fleetContext),
      tools,
      messages,
    });

    // No tool calls → done
    if (response.stop_reason !== 'tool_use') break;

    // Process tool calls
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
    const toolResults   = [];

    for (const toolUse of toolUseBlocks) {
      toolsUsed.push(toolUse.name);
      logger.info(`[Chatbot] Tool call: ${toolUse.name}(${JSON.stringify(toolUse.input)})`);

      let result;
      try {
        result = await executeTool(toolUse.name, toolUse.input);
      } catch (e) {
        logger.error(`[Chatbot] Tool ${toolUse.name} failed:`, e.message);
        result = { error: e.message };
      }

      toolResults.push({
        type:       'tool_result',
        tool_use_id: toolUse.id,
        content:    JSON.stringify(result),
      });
    }

    // Add assistant message and tool results to conversation
    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user',      content: toolResults });
  }

  // Extract final text response
  const textBlocks = response.content.filter(b => b.type === 'text');
  const reply = textBlocks.map(b => b.text).join('\n') || 'I could not generate a response.';

  return {
    reply,
    toolsUsed: [...new Set(toolsUsed)],
    tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens,
  };
}

module.exports = { chat };

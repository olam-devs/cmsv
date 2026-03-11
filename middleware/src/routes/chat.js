/**
 * routes/chat.js — AI Fleet Chatbot endpoint
 */

const express    = require('express');
const router     = express.Router();
const chatbot    = require('../chatbot/chatbot.service');
const logger     = require('../utils/logger');

/**
 * POST /api/chat
 * Body: { message: string, history?: [{role, content}] }
 * Returns: { reply, toolsUsed, tokensUsed }
 * 
 * Example questions:
 *   "Which vehicles are speeding right now?"
 *   "How much fuel did T123ABC use today?"
 *   "Show all alarms from yesterday"
 *   "How many vehicles are online?"
 *   "Which vehicles haven't reported in?"
 */
router.post('/', async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, message: 'message is required' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      success: false,
      message: 'Chatbot not configured — set ANTHROPIC_API_KEY in .env',
    });
  }

  logger.info(`[Chat] User: "${message.substring(0, 80)}..."`);

  const result = await chatbot.chat(message, history);

  logger.info(`[Chat] Reply generated. Tools: [${result.toolsUsed.join(', ')}]. Tokens: ${result.tokensUsed}`);

  res.json({
    success: true,
    reply:      result.reply,
    toolsUsed:  result.toolsUsed,
    tokensUsed: result.tokensUsed,
  });
});

module.exports = router;

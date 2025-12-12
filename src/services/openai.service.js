const { openai, openaiConfig } = require('../config/openai');

/**
 * OpenAI Service
 * Handles AI-powered prompt parsing and JSON generation
 */

class OpenAIService {
  /**
   * Parse user prompt and generate structured JSON for task/card creation
   * @param {string} userPrompt - The natural language prompt from the user
   * @returns {Promise<Object>} - Structured JSON output
   */
  async parsePromptToJSON(userPrompt) {
    try {
      const systemPrompt = `You are an AI assistant that converts natural language instructions into structured JSON for a task management system.

The system has the following structure:
- Workspaces: Top-level containers (e.g., "Experro", "Personal")
- Boards: Collections of tasks within a workspace (e.g., "A/B Testing", "Sprint Planning")
- Lists/Stages: Columns within a board (e.g., "To Do", "In Progress", "Done")
- Cards: Individual tasks with properties like title, description, priority, deadline

Your task is to parse user prompts and generate JSON in this exact format:
{
  "action": "create_card" | "update_card" | "move_card" | "delete_card",
  "workspace": "workspace name or null",
  "board": "board name or null",
  "list": "list/stage name or null",
  "card": {
    "title": "task title",
    "description": "task description or null",
    "priority": "low" | "medium" | "high" | "urgent" | null,
    "deadline": "YYYY-MM-DD format or null"
  }
}

Rules:
1. Extract workspace, board, and list names from the prompt
2. Set action based on keywords: "create", "add", "new" → "create_card"; "update", "edit", "change" → "update_card"; "move" → "move_card"; "delete", "remove" → "delete_card"
3. Priority should be one of: "low", "medium", "high", "urgent" (default to null if not specified)
4. Convert relative dates like "tomorrow", "next week", "in 3 days" to YYYY-MM-DD format based on today's date: ${new Date().toISOString().split('T')[0]}
5. If information is not provided, set it to null
6. Return ONLY valid JSON, no additional text or explanation

Examples:
Input: "create a card in the Marketing workspace's Campaign board - task name: Launch email campaign, deadline tomorrow, priority high"
Output: {"action":"create_card","workspace":"Marketing","board":"Campaign","list":null,"card":{"title":"Launch email campaign","description":null,"priority":"high","deadline":"${this.getTomorrowDate()}"}}

Input: "add a task to do: Review pull requests, priority medium"
Output: {"action":"create_card","workspace":null,"board":null,"list":"To Do","card":{"title":"Review pull requests","description":null,"priority":"medium","deadline":null}}`;

      const response = await openai.chat.completions.create({
        model: openaiConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: openaiConfig.temperature,
        max_tokens: openaiConfig.maxTokens,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      const parsedJSON = JSON.parse(content);

      // Validate the structure
      this.validateParsedJSON(parsedJSON);

      return {
        success: true,
        data: parsedJSON,
        usage: {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens
        }
      };
    } catch (error) {
      console.error('OpenAI Service Error:', error);
      throw new Error(`Failed to parse prompt: ${error.message}`);
    }
  }

  /**
   * Validate the parsed JSON structure
   * @param {Object} data - The parsed JSON data
   * @throws {Error} - If validation fails
   */
  validateParsedJSON(data) {
    const validActions = ['create_card', 'update_card', 'move_card', 'delete_card'];
    const validPriorities = ['low', 'medium', 'high', 'urgent', null];

    if (!data.action || !validActions.includes(data.action)) {
      throw new Error('Invalid or missing action');
    }

    if (data.card) {
      if (!data.card.title && data.action === 'create_card') {
        throw new Error('Card title is required for create_card action');
      }

      if (data.card.priority && !validPriorities.includes(data.card.priority)) {
        throw new Error('Invalid priority value');
      }

      if (data.card.deadline && !this.isValidDate(data.card.deadline)) {
        throw new Error('Invalid deadline format. Expected YYYY-MM-DD');
      }
    }
  }

  /**
   * Check if a date string is valid
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @returns {boolean}
   */
  isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;

    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  /**
   * Get tomorrow's date in YYYY-MM-DD format
   * @returns {string}
   */
  getTomorrowDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
}

module.exports = new OpenAIService();


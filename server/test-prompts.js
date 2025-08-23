import OllamaClient from './ollama-client.js';

const client = new OllamaClient();

// Test a single tech tweet
const techTweet = "Just shipped our YC-backed AI coding assistant. 10x faster completions using novel attention mechanism.";
console.log("Testing tech tweet:", techTweet);

const prompt = client.buildAnalysisPrompt(techTweet, {});
console.log("\nGenerated prompt preview (first 500 chars):");
console.log(prompt.substring(0, 500) + "...");

// Test generating completion
try {
  const response = await client.generateCompletion(prompt, { max_tokens: 100 });
  console.log("\nAI Response:", response);
  
  const parsed = client.parseAnalysisResponse(response);
  console.log("\nParsed result:");
  console.log("Score:", parsed.score);
  console.log("Is Signal:", parsed.isSignal);
  console.log("Reason:", parsed.reason);
} catch (err) {
  console.error("Error:", err.message);
}

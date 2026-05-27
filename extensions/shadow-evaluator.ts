import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PROHIBITED_PHRASES = [
	"Let me know",
	"Here is",
	"Sure",
	"I apologize",
	"I found",
	"I will",
	"I think"
];

export default function (pi: ExtensionAPI) {
	pi.on("message_end", async (event, ctx) => {
		if (event.message.role !== "assistant") return;

		// Extract text content from the assistant message
		let text = "";
		if (typeof event.message.content === "string") {
			text = event.message.content;
		} else if (Array.isArray(event.message.content)) {
			// In case it's a multipart message
			for (const part of event.message.content) {
				if (part.type === "text") {
					text += part.text;
				}
			}
		}

		if (!text) return;

		// Strip markdown code blocks to prevent false positives in generated code
		const textWithoutCode = text
			.replace(/```[\s\S]*?```/g, "")
			.replace(/`[^`]*`/g, "");

		// 1. Check for prohibited phrases (case-insensitive)
		const violations: string[] = [];
		for (const phrase of PROHIBITED_PHRASES) {
			const regex = new RegExp(`\\b${phrase}\\b`, "i");
			if (regex.test(textWithoutCode)) {
				violations.push(`"${phrase}"`);
			}
		}

		// 2. Check for missing structure if it looks like a diagnostic response
		// If it has ANY of the keywords, it should have ALL of them in the correct format.
		const hasDiagnosis = text.includes("**Diagnosis:**");
		const hasApplied = text.includes("**Applied:**");
		const hasNext = text.includes("**Next:**");
		const hasBullets = text.includes("•");

		if (hasDiagnosis || hasApplied || hasNext) {
			if (!hasDiagnosis || !hasApplied || !hasNext || !hasBullets) {
				violations.push("Malformed Mandatory Response Format (missing sections or using wrong bullets)");
			}
		}

		if (violations.length > 0) {
			const violationMsg = `Shadow Evaluator triggered: ${violations.join(", ")}`;
			
			// Notify the user in the UI (pops up a toast/notification)
			ctx.ui.notify(violationMsg, "error");

			// Append the correction to the assistant's message in the session history
			// so the LLM sees it as feedback on its next turn.
			const correctionLabel = `\n\n[SHADOW EVALUATOR PENALTY: ${violationMsg}. Protocol strictness MUST be observed.]`;
			
			let modifiedContent = event.message.content;
			if (typeof modifiedContent === "string") {
				modifiedContent += correctionLabel;
			} else if (Array.isArray(modifiedContent)) {
				modifiedContent = [...modifiedContent, { type: "text", text: correctionLabel }];
			}

			return {
				message: {
					...event.message,
					content: modifiedContent,
				}
			};
		}
	});
}

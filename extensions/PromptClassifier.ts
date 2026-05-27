import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type RoutingDecision = 'DIRECT' | 'DELEGATE' | 'CHAIN';

/**
 * Classifies a prompt based on keyword and pattern heuristics 
 * to determine the appropriate routing decision.
 */
export function classifyPrompt(text: string): RoutingDecision {
    const lowercaseText = text.toLowerCase();

    // CHAIN: Multi-step, complex pipelines
    if (
        /pipeline|multi-step|chain|sequence|step-by-step/i.test(lowercaseText)
    ) {
        return 'CHAIN';
    }

    // DELEGATE: Research, analysis, parallel tasks, scoping
    if (
        /analyze|research|parallel|scope|investigate|explore|recon/i.test(lowercaseText)
    ) {
        return 'DELEGATE';
    }

    // DIRECT: Everything else
    return 'DIRECT';
}

export default function (pi: ExtensionAPI) {
    // This file acts as a helper, no direct pi hooks needed for this module itself,
    // but the default export is required by the pi extension loader if it's placed in the extensions folder
}

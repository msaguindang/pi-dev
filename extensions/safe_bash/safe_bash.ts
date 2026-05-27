import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const PROTECTED_PATTERNS = [
  /rm -rf \//,
  /chmod 777/,
  /dd if=/,
  /mkfs/
];

export default async function (pi: any) {
  pi.registerTool({
    name: "safe_bash",
    description: "Runs shell commands safely and truncates output.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string" },
      },
      required: ["command"],
    },
    execute: async (_toolCallId: string, args: { command: string }, _signal: any, _onUpdate: any, ctx: any) => {
      if (PROTECTED_PATTERNS.some(p => p.test(args.command))) {
        return {
          content: [{ type: "text", text: "Action blocked: Command matches protected pattern." }]
        };
      }
      
      try {
        const { stdout, stderr } = await execAsync(args.command, { cwd: ctx.cwd });
        let output = stdout || stderr || "Command executed successfully.";
        
        if (output.length > 5000) {
           output = output.slice(0, 5000) + '... [TRUNCATED]';
        }
        
        return {
          content: [{ type: "text", text: output }]
        };
      } catch (e: any) {
        let errOut = e.stdout || e.stderr || e.message;
        if (errOut.length > 5000) {
           errOut = errOut.slice(0, 5000) + '... [TRUNCATED]';
        }
        return {
          content: [{ type: "text", text: `Command failed: ${errOut}` }]
        };
      }
    },
  });
}


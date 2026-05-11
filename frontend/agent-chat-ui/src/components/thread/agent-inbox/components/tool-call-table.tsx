import { ToolCall } from "@langchain/core/messages/tool";
import { unknownToPrettyDate } from "../utils";

export function ToolCallTable({ toolCall }: { toolCall: ToolCall }) {
  return (
    <div className="max-w-full min-w-[300px] overflow-hidden rounded-[2px] border border-[var(--umx-line)]">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th
              className="bg-[var(--umx-bg-2)] px-2 py-1 text-left font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--umx-silver)]"
              colSpan={2}
            >
              ▸ {toolCall.name}
            </th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(toolCall.args).map(([key, value]) => {
            let valueStr = "";
            if (["string", "number"].includes(typeof value)) {
              valueStr = value.toString();
            }

            const date = unknownToPrettyDate(value);
            if (date) {
              valueStr = date;
            }

            try {
              valueStr = valueStr || JSON.stringify(value, null);
            } catch (_) {
              // failed to stringify, just assign an empty string
              valueStr = "";
            }

            return (
              <tr
                key={key}
                className="border-t border-[var(--umx-line)]"
              >
                <td className="w-1/3 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em] font-medium text-[var(--umx-white)]">{key}</td>
                <td className="px-2 py-1 font-mono text-xs text-[var(--umx-silver)]">{valueStr}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

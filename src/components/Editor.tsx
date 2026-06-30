import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { colorPickerPlugin } from "../extensions/colorPicker";

interface EditorProps {
  code: string;
  onChange: (value: string) => void;
  isDarkMode?: boolean;
}

export function Editor({ code, onChange, isDarkMode = false }: EditorProps) {
  return (
    <div className="editor-container">
      <CodeMirror
        value={code}
        height="100%"
        theme={isDarkMode ? oneDark : "light"}
        extensions={[colorPickerPlugin]}
        onChange={(val) => onChange(val)}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          foldGutter: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
        }}
      />
    </div>
  );
}

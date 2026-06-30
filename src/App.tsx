import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Editor } from "./components/Editor";
import { PreviewPane } from "./components/PreviewPane";
import { EngineSelector } from "./components/EngineSelector";
import { ExportControls } from "./components/ExportControls";
import { useDebounce } from "./hooks/useDebounce";
import { getRendererById } from "./renderers/registry";
import { useDraftPersistence, getDraftState } from "./hooks/useDraftPersistence";
import { generateShareUrl, parseShareUrl } from "./share/shareUrl";
import { Moon, Sun, Share2, GripVertical, GripHorizontal } from "lucide-react";
import { Toaster, toast } from "sonner";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { useMediaQuery } from "./hooks/useMediaQuery";
import "./App.css";

function App() {
  const { t, i18n } = useTranslation();
  const isMobile = useMediaQuery("(max-width: 768px)");
  // Initialization order: Share URL > LocalStorage > Default
  const initialShareState = parseShareUrl();
  const initialDraftState = getDraftState();
  const fallbackRenderer = getRendererById("mermaid")!;
  let targetEngineId = initialShareState?.engine || initialDraftState?.engine || "mermaid";
  let targetRenderer = getRendererById(targetEngineId);
  
  if (!targetRenderer) {
    targetEngineId = "mermaid";
    targetRenderer = fallbackRenderer;
  }

  let targetVersion = initialShareState?.version || initialDraftState?.version || targetRenderer.defaultVersion;
  if (!targetRenderer.supportedVersions.includes(targetVersion)) {
    targetVersion = targetRenderer.defaultVersion;
  }
  
  const sampleKey = `samples.${targetEngineId}`;
  const translatedSample = i18n.exists(sampleKey) ? t(sampleKey) : targetRenderer.defaultSampleCode;
  const initialCode = initialShareState?.code || initialDraftState?.code || translatedSample;

  const [state, setState] = useDraftPersistence({
    engine: targetEngineId,
    version: targetVersion,
    code: initialCode,
  });

  const { engine: engineId, version, code } = state;
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Initial load: check OS theme
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });
  
  useEffect(() => {
    // Sync dark mode to the root element for global CSS
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const renderer = getRendererById(engineId);
  const debouncedCode = useDebounce(code, 400);

  const [svg, setSvg] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!renderer || !debouncedCode) return;

    let isMounted = true;
    
    const loadingTimer = setTimeout(() => {
      if (isMounted) setIsLoading(true);
    }, 150);

    renderer.render(debouncedCode, version).then((result) => {
      clearTimeout(loadingTimer);
      if (!isMounted) return;
      if (result.success) {
        setSvg(result.svg);
        setError(undefined);
      } else {
        setSvg(undefined);
        setError(result.error);
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(loadingTimer);
    };
  }, [debouncedCode, renderer, version]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      document.body.style.colorScheme = "dark";
    } else {
      document.documentElement.classList.remove("dark");
      document.body.style.colorScheme = "light";
    }
  }, [isDarkMode]);

  const handleEngineChange = (newEngineId: string) => {
    const newRenderer = getRendererById(newEngineId);
    if (newRenderer) {
      if (newRenderer.requiresExternalService) {
        toast.warning(t("engine.plantumlWarning"), { duration: 5000 });
      }
      const sampleKey = `samples.${newEngineId}`;
      const translatedSample = i18n.exists(sampleKey) ? t(sampleKey) : newRenderer.defaultSampleCode;
      
      setState({
        engine: newEngineId,
        version: newRenderer.defaultVersion,
        code: translatedSample,
      });
    }
  };

  const handleVersionChange = (newVersion: string) => {
    setState({ ...state, version: newVersion });
  };

  const handleCodeChange = (newCode: string) => {
    setState({ ...state, code: newCode });
  };

  const handleShare = async () => {
    const url = generateShareUrl(state);
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("app.copyLinkSuccess"));
    } catch (err) {
      toast.error(`${t("app.copyLinkFail")}${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    const isOldSample = ['en', 'zh-TW', 'zh-CN'].some(lng => 
      t(`samples.${state.engine}`, { lng }) === state.code
    ) || state.code === renderer?.defaultSampleCode;

    i18n.changeLanguage(newLang).then(() => {
      if (isOldSample) {
        handleCodeChange(i18n.t(`samples.${state.engine}`, { lng: newLang }));
      }
    });
  };

  const currentVersion = `v${__APP_VERSION__}`;

  return (
    <div className={`app-container ${isDarkMode ? 'dark-theme' : ''}`}>
      <Toaster position="bottom-right" theme={isDarkMode ? "dark" : "light"} />
      <header className="app-header">
        <h1>Better Diagrams as Code to Image</h1>
        <div className="header-controls">
          <EngineSelector
            engineId={engineId}
            version={version}
            onEngineChange={handleEngineChange}
            onVersionChange={handleVersionChange}
          />
          <select 
            value={i18n.resolvedLanguage || 'en'} 
            onChange={handleLanguageChange}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color, #ccc)', background: 'var(--header-bg)', color: 'var(--text-color)' }}
            title={t("app.language")}
          >
            <option value="en">EN</option>
            <option value="zh-TW">繁體</option>
            <option value="zh-CN">简体</option>
          </select>
          <button 
            className="header-btn" 
            onClick={handleShare}
            title={t("app.copyLink")}
          >
            <Share2 size={16} />
            {t("app.copyLink")}
          </button>
          <button 
            className="theme-toggle" 
            onClick={() => setIsDarkMode(!isDarkMode)}
            title={t("app.themeToggle")}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* 獨立一層的 Sub-header 工具列 */}
      <div className="sub-header-toolbar">
        <ExportControls svg={svg} disabled={isLoading || !!error || !svg} />
      </div>

      <main className="app-main">
        <PanelGroup orientation={isMobile ? "vertical" : "horizontal"} className="panel-group">
          <Panel defaultSize={50} minSize={20} className="left-pane">
            <Editor code={code} onChange={handleCodeChange} isDarkMode={isDarkMode} />
          </Panel>
          
          <PanelResizeHandle className="panel-resizer">
            <div className="resizer-handle">
              {isMobile ? <GripHorizontal size={16} /> : <GripVertical size={16} />}
            </div>
          </PanelResizeHandle>
          
          <Panel defaultSize={50} minSize={20} className="right-pane">
            <PreviewPane svg={svg} error={error} isLoading={isLoading} />
          </Panel>
        </PanelGroup>
      </main>

      <footer className="app-footer">
        <p className="footer-desc">{t("app.description")}</p>
        <p>
          {t("app.title")} {currentVersion} - Powered by Vite + React | 
          <a href="https://github.com/jay7895214/better-diagram-as-code-to-image" target="_blank" rel="noopener noreferrer"> {t("app.repo")}</a>
        </p>
      </footer>
    </div>
  );
}

export default App;

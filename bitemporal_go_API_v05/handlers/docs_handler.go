package handlers

import (
	"bytes"
	"html/template"
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	goldmarkhtml "github.com/yuin/goldmark/renderer/html"
)

var (
	docsRootOnce sync.Once
	docsRootPath string
)

func DocsIndex(ctx *gin.Context) {
	root := getDocsRootPath()
	relativeFiles := collectMarkdownFiles(root)

	entries := make([]docsEntry, 0, len(relativeFiles))
	for _, rel := range relativeFiles {
		entries = append(entries, docsEntry{
			Path: rel,
			URL:  "/docs/" + path.Clean(strings.TrimPrefix(filepath.ToSlash(rel), "/")),
		})
	}

	ctx.Header("Content-Type", "text/html; charset=utf-8")
	if err := docsIndexTemplate.Execute(ctx.Writer, gin.H{
		"Title":    "Markdown docs",
		"RootPath": root,
		"Entries":  entries,
	}); err != nil {
		ctx.String(http.StatusInternalServerError, "Failed to render docs index")
		return
	}
}

func DocsPage(ctx *gin.Context) {
	requested := strings.TrimPrefix(ctx.Param("filepath"), "/")
	requested = path.Clean(requested)
	if requested == "." || requested == "" {
		DocsIndex(ctx)
		return
	}
	if strings.HasPrefix(requested, "../") || strings.Contains(requested, "/../") {
		ctx.String(http.StatusBadRequest, "Invalid path")
		return
	}
	if strings.ToLower(path.Ext(requested)) != ".md" {
		ctx.String(http.StatusBadRequest, "Only .md files are supported")
		return
	}

	root := getDocsRootPath()
	relPath := filepath.FromSlash(requested)
	fullPath := filepath.Join(root, relPath)

	rootAbs, err := filepath.Abs(root)
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Failed to resolve docs root")
		return
	}
	fileAbs, err := filepath.Abs(fullPath)
	if err != nil {
		ctx.String(http.StatusBadRequest, "Invalid file path")
		return
	}
	if fileAbs != rootAbs && !strings.HasPrefix(fileAbs, rootAbs+string(os.PathSeparator)) {
		ctx.String(http.StatusBadRequest, "Path escapes project root")
		return
	}

	content, err := os.ReadFile(fileAbs)
	if err != nil {
		if os.IsNotExist(err) {
			ctx.String(http.StatusNotFound, "Markdown file not found")
			return
		}
		ctx.String(http.StatusInternalServerError, "Failed to read markdown file")
		return
	}

	md := goldmark.New(
		goldmark.WithExtensions(
			extension.GFM,
			extension.Table,
			extension.Strikethrough,
			extension.TaskList,
		),
		goldmark.WithRendererOptions(
			goldmarkhtml.WithUnsafe(),
		),
	)

	var rendered bytes.Buffer
	if err := md.Convert(content, &rendered); err != nil {
		ctx.String(http.StatusInternalServerError, "Failed to render markdown")
		return
	}

	ctx.Header("Content-Type", "text/html; charset=utf-8")
	if err := docsPageTemplate.Execute(ctx.Writer, gin.H{
		"Title":       filepath.ToSlash(relPath),
		"FilePath":    filepath.ToSlash(relPath),
		"HTMLContent": template.HTML(rendered.String()),
	}); err != nil {
		ctx.String(http.StatusInternalServerError, "Failed to render docs page")
		return
	}
}

func getDocsRootPath() string {
	docsRootOnce.Do(func() {
		wd, err := os.Getwd()
		if err != nil {
			docsRootPath = "."
			return
		}
		docsRootPath = findProjectRoot(wd)
	})
	return docsRootPath
}

func findProjectRoot(start string) string {
	current, err := filepath.Abs(start)
	if err != nil {
		return "."
	}

	for {
		gitPath := filepath.Join(current, ".git")
		if stat, err := os.Stat(gitPath); err == nil && stat.IsDir() {
			return current
		}

		parent := filepath.Dir(current)
		if parent == current {
			return start
		}
		current = parent
	}
}

func collectMarkdownFiles(root string) []string {
	relativeFiles := make([]string, 0, 64)
	_ = filepath.WalkDir(root, func(current string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}

		if d.IsDir() {
			name := d.Name()
			switch name {
			case ".git", "node_modules", "vendor", ".idea", ".vscode":
				return filepath.SkipDir
			}
			return nil
		}

		if strings.ToLower(filepath.Ext(d.Name())) != ".md" {
			return nil
		}

		rel, err := filepath.Rel(root, current)
		if err != nil {
			return nil
		}
		relativeFiles = append(relativeFiles, filepath.ToSlash(rel))
		return nil
	})

	sort.Strings(relativeFiles)
	return relativeFiles
}

type docsEntry struct {
	Path string
	URL  string
}

var docsIndexTemplate = template.Must(template.New("docs-index").Parse(`<!doctype html>
<html lang="nl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{ .Title }}</title>
    <style>
      :root {
        --bg: #f8fafc;
        --card: #ffffff;
        --line: #d0d7de;
        --text: #1f2328;
        --muted: #59636e;
        --link: #0969da;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "Noto Sans", sans-serif;
        background: linear-gradient(180deg, #eef6ff 0%, var(--bg) 220px);
        color: var(--text);
      }
      main {
        width: min(980px, calc(100vw - 24px));
        margin: 18px auto 32px;
      }
      .card {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 18px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: clamp(22px, 2.8vw, 30px);
      }
      p { color: var(--muted); }
      ul {
        margin: 0;
        padding-left: 18px;
        columns: 2;
        column-gap: 22px;
      }
      li { margin: 6px 0; break-inside: avoid; }
      a { color: var(--link); text-underline-offset: 2px; }
      .toplinks {
        margin-top: 10px;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      @media (max-width: 860px) {
        ul { columns: 1; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="card">
        <h1>Markdown documenten</h1>
        <p>Gevonden vanaf projectroot: {{ .RootPath }}</p>
        <div class="toplinks">
          <a href="/">Naar startpagina</a>
          <a href="/viz/">Naar viz</a>
        </div>
      </section>
      <section class="card" style="margin-top: 12px">
        <ul>
          {{ range .Entries }}
          <li><a href="{{ .URL }}">{{ .Path }}</a></li>
          {{ else }}
          <li>Geen markdown bestanden gevonden.</li>
          {{ end }}
        </ul>
      </section>
    </main>
  </body>
</html>`))

var docsPageTemplate = template.Must(template.New("docs-page").Parse(`<!doctype html>
<html lang="nl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{ .Title }}</title>
    <style>
      :root {
        --bg: #f6f8fa;
        --paper: #ffffff;
        --line: #d0d7de;
        --text: #1f2328;
        --muted: #59636e;
        --link: #0969da;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
        background: linear-gradient(180deg, #eef6ff 0%, var(--bg) 160px);
        color: var(--text);
      }
      .wrap {
        width: min(1100px, calc(100vw - 24px));
        margin: 18px auto 32px;
      }
      .card {
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 12px;
      }
      .topbar {
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: baseline;
        flex-wrap: wrap;
      }
      .crumb {
        color: var(--muted);
        font-size: 14px;
      }
      .links {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .links a {
        color: var(--link);
        text-decoration: none;
      }
      .links a:hover {
        text-decoration: underline;
      }
      article.markdown-body {
        padding: 24px;
        line-height: 1.6;
      }
      .markdown-body h1,
      .markdown-body h2,
      .markdown-body h3,
      .markdown-body h4 {
        margin-top: 1.3em;
        margin-bottom: 0.5em;
      }
      .markdown-body code,
      .markdown-body pre {
        font-family: Consolas, "Cascadia Code", Menlo, monospace;
      }
      .markdown-body pre {
        background: #f6f8fa;
        border: 1px solid #d8dee4;
        border-radius: 8px;
        overflow: auto;
        padding: 12px;
      }
      .markdown-body code {
        background: #f6f8fa;
        border-radius: 6px;
        padding: 0.1em 0.35em;
      }
      .markdown-body pre code {
        background: transparent;
        border-radius: 0;
        padding: 0;
      }
      .markdown-body table {
        border-collapse: collapse;
        width: 100%;
        margin: 14px 0;
      }
      .markdown-body table th,
      .markdown-body table td {
        border: 1px solid #d0d7de;
        padding: 6px 10px;
        text-align: left;
      }
      .markdown-body blockquote {
        margin: 1em 0;
        padding: 0.2em 1em;
        border-left: 4px solid #d0d7de;
        color: #57606a;
      }
      .markdown-body a {
        color: var(--link);
      }
      .markdown-body img {
        max-width: 100%;
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="card topbar">
        <span class="crumb">Bestand: {{ .FilePath }}</span>
        <nav class="links" aria-label="Navigatie">
          <a href="/docs">Alle docs</a>
          <a href="/">Startpagina</a>
          <a href="/viz/">Viz</a>
        </nav>
      </section>
      <section class="card" style="margin-top: 12px">
        <article class="markdown-body">
          {{ .HTMLContent }}
        </article>
      </section>
    </main>
  </body>
</html>`))

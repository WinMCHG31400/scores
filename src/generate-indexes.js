const fs = require('fs');
const path = require('path');
let isIgnored = () => false; // 默认不忽略任何文件
const CONFIG = {
  IGNORED_FILES: `
    README.md
    src/*
    .gitattributes
    .gitignore
    package.json
    package-lock.json
    .git/*
    `, // 忽略文件列表的文件路径
  BASE_URL: 'https://winmchg31400-scores.pages.dev', // 部署域名
};

function simpleGitignore(patterns) {
  const ignoreList = [];
  const unignoreList = [];

  patterns.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;

    if (line.startsWith('!')) {
      unignoreList.push(line.substring(1));
    } else {
      ignoreList.push(line);
    }
  });

  return function (filePath) {
    // 简单匹配（处理常见场景）
    for (const unignore of unignoreList) {
      if (filePath.includes(unignore)) return false;
    }

    for (const ignore of ignoreList) {
      // 目录匹配
      if (ignore.endsWith('/')) {
        if (filePath.startsWith(ignore)) return true;
        continue;
      }

      // 通配符匹配
      if (ignore.includes('*')) {
        const regex = new RegExp(
          ignore
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '[^/]')
        );
        if (regex.test(filePath)) return true;
        continue;
      }

      // 精确匹配
      if (filePath.includes(ignore) || filePath.endsWith(ignore)) {
        return true;
      }
    }

    return false;
  };
}

function generateDirectoryIndex(dirPath, relativePath = '') {
  const items = fs.readdirSync(dirPath);
  // 检查是否已有 index.html
  if (items.includes('index.html') && dirPath !== '.') {
    return;
  }

  const displayPath = relativePath || '/';
  const isRoot = dirPath === '.';

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>目录索引 - ${displayPath}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
            background: linear-gradient(135deg, #f9f9f9 0%, #909090 100%);
            min-height: 100vh;
            padding: 40px 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(92, 92, 92, 0.3);
            overflow: hidden;
        }
        .header {
            background: #1e293b;
            color: white;
            padding: 20px 30px;
        }
        .header h1 {
            font-size: 20px;
            font-weight: 500;
            word-break: break-all;
        }
        .header h1::before {
            content: '📁 ';
        }
        .file-list {
            padding: 20px 30px;
        }
        .file-item {
            display: flex;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #e2e8f0;
            transition: background 0.2s;
        }
        .file-item:hover {
            background: #f8fafc;
            padding-left: 10px;
        }
        .icon {
            width: 32px;
            font-size: 20px;
            margin-right: 12px;
        }
        .name {
            flex: 1;
            font-size: 14px;
        }
        .name a {
            color: #3b82f6;
            text-decoration: none;
        }
        .name a:hover {
            text-decoration: underline;
        }
        .size {
            color: #64748b;
            font-size: 12px;
            font-family: monospace;
        }
        .footer {
            background: #f1f5f9;
            padding: 12px 30px;
            text-align: center;
            font-size: 12px;
            color: #64748b;
        }
        @media (max-width: 640px) {
            .container { margin: 0; border-radius: 0; }
            .header, .file-list { padding: 15px 20px; }
            .size { display: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${escapeHtml(displayPath)}</h1>
        </div>
        <div class="file-list">
            ${!isRoot ? `
            <div class="file-item">
            <div class="icon">📂</div>
            <div class="name"><a href="../">../</a></div>
            <div class="size">父目录</div>
        </div>` : ''}`;

  // 先列出目录，再列出文件
  const directories = [];
  const files = [];

  for (const item of items) {
    if (item === 'index.html' || item === '.git' || item === '.github' || item === 'src' || isIgnored(item)) continue;

    const itemPath = path.join(dirPath, item);
    const isDir = fs.statSync(itemPath).isDirectory();
    const itemDisplay = isDir ? `${item}/` : item;

    if (isDir) {
      directories.push({ name: item, display: itemDisplay, isDir: true });
    } else {
      const stats = fs.statSync(itemPath);
      files.push({
        name: item,
        display: itemDisplay,
        isDir: false,
        size: stats.size,
        sizeText: formatFileSize(stats.size)
      });
    }
  }

  // 排序：目录在前，文件在后，各自按名称排序
  directories.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  for (const dir of directories) {
    html += `
            <div class="file-item">
                <div class="icon">📁</div>
                <div class="name"><a href="${dir.display}">${escapeHtml(dir.display)}</a></div>
                <div class="size">目录</div>
            </div>`;
  }

  for (const file of files) {
    // 判断是否为PDF文件
    const isPdf = file.name.toLowerCase().endsWith('.pdf');

    let fileUrl;
    if (isPdf) {
      // 构建PDF文件的完整URL
      const pdfPath = relativePath ? `${relativePath}/${file.name}` : file.name;
      // 确保路径格式正确（移除多余的斜杠）
      const cleanPath = pdfPath.replace(/^\/+/, '').replace(/\/+/g, '/');
      // 构建完整的可访问URL
      const fullUrl = `${CONFIG.BASE_URL}/${cleanPath}`;
      // 对完整URL进行编码
      const encodedPath = encodeURIComponent(fullUrl);
      fileUrl = `https://res.oplist.org/pdf.js/web/viewer.html?file=${encodedPath}`;
    } else {
      fileUrl = file.display;
    }

    html += `
            <div class="file-item">
                <div class="icon">${isPdf ? '📕' : '📄'}</div>
                <div class="name"><a href="${fileUrl}" ${isPdf ? 'target="_blank"' : ''}>${escapeHtml(file.display)}</a></div>
                <div class="size">${file.sizeText}</div>
            </div>`;
  }

  html += `
        </div>
        <div class="footer">
       
    </div>
</body>
</html>
  `;

  fs.writeFileSync(path.join(dirPath, 'index.html'), html);
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
  return text.replace(/[&<>]/g, function (m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function walkDirectory(dirPath, basePath = '') {
  const items = fs.readdirSync(dirPath);

  // 为当前目录生成索引
  generateDirectoryIndex(dirPath, basePath);

  // 递归处理子目录
  for (const item of items) {
    if (item === '.git' || item === '.github') continue;

    const itemPath = path.join(dirPath, item);
    if (fs.statSync(itemPath).isDirectory()) {
      const newBasePath = basePath ? `${basePath}/${item}` : item;
      walkDirectory(itemPath, newBasePath);
    }
  }
}

// 从当前目录开始
isIgnored = new simpleGitignore(CONFIG.IGNORED_FILES);
console.log(' 开始生成目录索引文件...');
walkDirectory('.');
console.log(' 索引文件生成完成！');
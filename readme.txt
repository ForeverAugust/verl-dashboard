VERL RL Dashboard 服务启动说明
================================

环境要求
--------
- Node.js（建议 18 及以上）
- npm

安装依赖
--------
    npm install

启动命令
--------
开发模式（推荐，带热更新）：
    npm run dev

生产模式（先构建再启动）：
    npm run build
    npm start

访问地址
--------
服务启动后，在浏览器打开：
    http://localhost:3000

配置说明
--------
本服务使用 Gemini API（可选）。如需启用，在项目根目录创建 .env 文件并填入：
    GEMINI_API_KEY=你的_API_KEY
未配置时服务仍可启动，只是 AI 相关功能不可用。

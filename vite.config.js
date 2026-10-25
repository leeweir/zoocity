export default {
  base: './', // 相对路径，适配 GitHub Pages 子路径 /zoocity/
  server: { watch: { ignored: ['**/.playwright-mcp/**'] } },
  build: { chunkSizeWarningLimit: 4000 },
};

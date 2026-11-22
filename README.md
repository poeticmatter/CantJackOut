# Can't Jack Out

A push-your-luck hacking game built on the loop of Can't Stop. Jack into corporate servers, roll colored dice to download their files, and decide whether to bank or push. Pay your fixer at every dawn for ten nights.

**Play:** https://poeticmatter.github.io/CantJackOut/

- [How to play](docs/rules.md)
- [Design log](docs/design-log.md)

## Development

```bash
npm install
npm run dev        # play locally
npm test           # rules tests and a UI smoke test
npm run deploy     # publish to GitHub Pages
npm run stats      # Can't Stop statistics used for calibration
npm run calibrate meta 100   # play 100 bot campaigns
```

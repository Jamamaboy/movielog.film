# Movie Log .film

Turn the pages of your handwritten movie log into Instagram Stories.

Take a photo of a page, pick a review box, choose a layout and a card style, add your own photos, and get a 1080 × 1920 image ready to share. Every finished page is kept in **My Log**, a book you can flip through.

No account and no server: everything runs in your browser and stays on your device, like [Excalidraw](https://excalidraw.com/).

## Features (v0.1.0)

- **Capture**: take or upload a photo of a log page (a sample page is included)
- **Detect**: straightens a tilted photo and finds the review boxes; drag the corners to adjust
- **Ink only**: removes the paper so only the handwriting and printed lines remain
- **Layouts**: 4 story layouts that size themselves to the review
- **Card styles**: Clear, Paper, Gray, Space, Film, Ticket, with any text colour
- **Photos**: add photos to each slot, then move and zoom them
- **My Log**: a book view with the date each page was added, plus a grid view
- **Your data**: export / import a `.movielog` backup, or save every page to a folder (Chrome / Edge on desktop)

## Develop

Needs Node 24 (see `.nvmrc`).

```sh
nvm use
npm install
npm run dev -- --host   # --host lets a phone on the same Wi-Fi open it
```

```sh
npm run check   # type check
npm run build   # static site in build/
```

Built with SvelteKit (static adapter). Image processing uses plain Canvas code in the browser.

## License

MIT

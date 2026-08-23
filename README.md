# GamePhaser

Repo **private** — nguồn quản lý hub static (HTML5). Push `main` sẽ auto-deploy sang repo Pages public.

| | URL |
|---|-----|
| Source (private) | https://github.com/Trandangtruong/GamePhaser |
| Pages (public) | https://github.com/Trandangtruong/GamePhaser-pages |
| Website | https://trandangtruong.github.io/GamePhaser-pages/ |

| Game | Thư mục | URL |
|------|---------|-----|
| Foodie Match | `food/` | https://trandangtruong.github.io/GamePhaser-pages/food/ |
| Tile Trip | `title/` | https://trandangtruong.github.io/GamePhaser-pages/title/ |
| Goods Tidy | `tidy/` | https://trandangtruong.github.io/GamePhaser-pages/tidy/ |
| Pikachu | `Pikachu/` | https://trandangtruong.github.io/GamePhaser-pages/Pikachu/ |
| Tetris | `Tetris/` | https://trandangtruong.github.io/GamePhaser-pages/Tetris/ |

## Cấu trúc

```
GamePhaser/
  .nojekyll          # bắt buộc — tắt Jekyll
  index.html         # danh sách game
  food/              # build static của Foodie Match
  <game-khac>/       # thêm game mới cùng kiểu
  .github/workflows/ # deploy → GamePhaser-pages
```

## Thêm / cập nhật một game

1. Trong project source, build static (relative `base: './'`):

   ```bash
   npm run build:static-web
   ```

2. Copy **đè** vào thư mục game (không tạo `food-2/`):

   ```bash
   cd "/Users/trandangtruong/Documents/GamePhaser"
   ./scripts/update-game.sh food "/Users/trandangtruong/Documents/Game AI/Food/web" --commit "Update food"
   git push origin main
   ```

3. Game **mới**: chạy `update-game.sh <slug> …`, thêm 1 link trong `index.html`, commit + push.

Build **phải** dùng đường dẫn tương đối (`base: './'`). Nếu dùng `base: '/'`, asset sẽ 404 khi mở `/GamePhaser-pages/food/`.

Push `main` → GitHub Actions copy sang `GamePhaser-pages` (public). Link website share được; repo source chỉ bạn / người được cấp quyền xem.

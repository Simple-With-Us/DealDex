# DealDex AppIcon options (archive)

Live launcher is `assets/brand/dealdex-dd-icon-1024.png` — interlocking DD on
the Socratic.Trade tiled field. Rebuild it with
`python3 scripts/generate-app-icons.py`.

These files are leftover scale/background previews from before the owner
picked the ST grid:

| File             | Background                              | DD scale vs edge-to-edge               |
| ---------------- | --------------------------------------- | -------------------------------------- |
| `ct-gray-90.png` | Congress.Trade light gray + oval shadow | 10% smaller                            |
| `ct-gray-80.png` | same                                    | 20% smaller                            |
| `ct-gray-72.png` | same                                    | extra padding (closer to the CT eagle) |
| `st-grid-90.png` | Socratic.Trade light grid + oval shadow | 10% smaller                            |
| `st-grid-80.png` | same                                    | 20% smaller                            |
| `st-grid-72.png` | same                                    | extra padding                          |
| `sheet.png`      | contact sheet of all six                | —                                      |

Regenerate this folder: `python3 scripts/generate-icon-options.py`

# Animal Mash: making the pictures

The game uses `images/<id>.png` for each animal that has one, and falls back
to the drawn SVG for any that don't. So you can add them one at a time.

## How a mash is made

The head animal's **front half** is laid over the body animal's **back half**
and the seam is blended. For that to look good, every picture has to be
framed the same way:

- One animal, **side view, facing right**, standing, whole body in frame
  (all four feet, the tail, the ears).
- The **head and front legs on the right half**, the **back legs and tail
  on the left half**. The middle of the picture is where the cut happens.
- **Plain flat white background**, nothing on the ground, no shadow, no
  scenery, no text. The game removes the white itself. (A transparent PNG
  also works.)
- A **clear dark outline** all round, so a white animal (rabbit, cow, sheep)
  doesn't melt into the background.
- Roughly the same body proportions and pose for every animal (a calm,
  standing, friendly pose), so halves line up when swapped.
- Any size, 1024 px is plenty. Square or landscape, it is trimmed to the animal.
- Head is a bit big for the body, big friendly eyes, smiling, no teeth, nothing scary.

## Style prompt (put this first, every time, so they all match)

> Cute children's picture-book illustration of a {ANIMAL}, side view facing
> right, standing on all four legs in a calm friendly pose, whole body visible
> from nose to tail, big round head, large shiny friendly eyes, gentle smile,
> soft rounded shapes, smooth shading, thick clean dark outline, bright
> cheerful colours. Single animal centred on a plain flat pure white
> background, no ground, no shadow, no text, no other objects.

Use the same tool, the same style words and, if the tool allows, the same
seed or a style reference image (the first good one) for all of them.
Replace `{ANIMAL}` with the line below.

## Animals

Save each as the file name shown, inside `games/animal-mash/images/`.

| File | {ANIMAL} |
|---|---|
| `cat.png` | ginger tabby cat with white paws |
| `pig.png` | pink pig with a curly tail |
| `frog.png` | green frog (on all four limbs, not leaping) |
| `elephant.png` | grey elephant with big ears and a trunk |
| `duck.png` | yellow duck with orange beak and webbed feet |
| `giraffe.png` | giraffe with a long neck and brown patches |
| `dog.png` | brown puppy with floppy ears |
| `cow.png` | black and white cow |
| `rabbit.png` | fluffy white rabbit with long ears |
| `penguin.png` | penguin (standing upright is fine, facing right) |
| `lion.png` | lion with a golden mane |

## Checking

Images are only read when the page is served over http(s), which the live site
is. Opened straight off the disk, the browser blocks it and you get the drawn
animals instead. To test locally, from the project folder run
`python -m http.server 8765` and open
`http://localhost:8765/games/animal-mash/animal-mash.html`.

## Adding a new animal

Add its picture here and an entry to `ANIMALS` in the game (a name, the two
name halves, a tray colour and a sound; the drawn art can be a rough
placeholder).

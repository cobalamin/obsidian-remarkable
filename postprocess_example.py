#!/usr/bin/env python3
import sys

from PIL import Image, ImageOps
import numpy as np


if __name__ == '__main__':
    assert len(sys.argv) == 2, "Image path must be passed!"
    path = sys.argv[1]

    # load image, discard alpha (if present)
    img = Image.open(path).convert("RGB")

    # remove menu and indicators
    data = np.array(img)
    menu_is_open = (data[52:58, 52:58] == 0).all()
    if menu_is_open:
        # remove the entire menu, and the x in the top right corner
        data[:, :120, :] = 255
        data[40:81, 1324:1364, :] = 255
    else:
        # remove only the menu indicator circle
        data[40:81, 40:81, :] = 255

    # crop to the bounding box
    img = Image.fromarray(data).convert("RGB")
    bbox = ImageOps.invert(img).getbbox()
    img = img.crop(bbox)

    # set alpha channel
    data = np.array(img.convert("RGBA"))
    # copy inverted red channel to alpha channel, so that the background is transparent
    # (could have also used blue or green here, doesn't matter)
    data[..., -1] = 255 - data[..., 0]
    img = Image.fromarray(data)
    img.save(path)

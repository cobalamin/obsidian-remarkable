## Obsidian & reMarkable

This a plugin integrating the [reMarkable](https://remarkable.com) paper tablet with the note-taking software [Obsidian](https://obsidian.md). More specifically, it takes a screenshot from your reMarkable (via USB or WiFi, however you prefer), saves it as a .png files in your Vault, optionally post-processes it, and inserts the image in your currently open note.

![Preview of the plugin functionality](https://user-images.githubusercontent.com/669103/123702539-8c2c2f80-d863-11eb-952d-acbb8df0a146.gif)


### Installation

#### Prerequisites

- Set up [reSnap](https://github.com/cloudsftp/reSnap) on your reMarkable tablet and on your computer.
- Set up your reMarkable so you have passwordless access over SSH, see https://www.reddit.com/r/RemarkableTablet/comments/78u90n/passwordless_ssh_setup_for_remarkable_tablet/
- Install and activate this plugin in Obsidian.

Now, go to this plugin's settings page and configure them as described below.

#### Settings
Open the settings window for this plugin, and:
- "reSnap executable": Enter the absolute path to the previously installed `reSnap.sh`.
- "reMarkable IP": Enter the IP address of your rM. If you have your rM connected via cable, this should just be `10.11.99.1`. If you want to use this plugin's functionality over WiFi, get the rM's IP via its menu, under *Help > Copyrights and licenses*, and there at the bottom.
- Enter the output folder in your Vault where you would like the plugin to store the images captured from your rM.

### Usage

There are two commands:

- *Insert a drawing from the reMarkable*
- *Insert a landscape-format drawing from the reMarkable*

They do exactly what they say (the first inserts in portrait mode). Simply use them via the command pane, or configure some keyboard shortcuts.

#### Postprocessing script
Optionally, you can add a postprocessing script that further modifies the captured images. As an example, I've added the Python script I use. It

- automatically removes the menu and buttons
- crops away any remaining whitespace
- turns the white background transparent

It was used for the example workflow shown in the GIF at the beginning of this file. This script is available as `postprocess_example.py` in this repository. It requires the Python packages `numpy` and `PIL` to be installed and available.

You can, however, run anything you'd like as a postprocessing script. The only requirements of this plugin is that whatever script you use

- receives one argument: the absolute path to the captured image file
- overwrites this image file in-place, also using the PNG output format

I might relax these requirements in the future if people want to do fancier stuff with it.

### Tips

- If you are using Dark Mode, I would recommend to add a CSS rule that inverts the captured images, so black pen strokes become white and stand out nicely. My plugin can't automatically tell apart images captured from the rM and other images, so I followed these steps:
  - In this plugin's settings, set an output folder that is used *solely* for rM captures and has an unique name. I used `rM drawings`.
  - Added a CSS snippet (see *Appearance* tab in Obsidian settings) with the following content:
  ```css
  body.theme-dark img[src*="rM%20drawings"] {
    filter: invert(1);
  }
  ```
  - Enable this snippet :)
- I would recommend also installing [Ozan's Image in Editor Plugin](https://github.com/ozntel/oz-image-in-editor-obsidian), which will show you the captured images directly in editor mode.
- If you want to make your rM handwriting searchable, you might like to try the [Obsidian OCR plugin](https://github.com/schlundd/obsidian-ocr-plugin). I've not tested it extensively, but it worked well on some semi-clean handwriting I tried.


### Possible future features

- [ ] Configurable output file name patterns
- [ ] Other available sources for screenshots besides the reMarkable, making this a general plugin for quickly inserting image content from your favorite devices
- [ ] Automatically tell apart rM captures from other images, for automatic dark-mode styling (but I don't know how I would do that)
- [ ] Integration with the reMarkable's own OCR feature (but this will be very slow, unlike this plugin currently)
- [ ] rM integration that goes beyond the screenshot feature. Maybe you have some ideas for that?

If you'd like to see any new features implemented and could help me out, let me know via the Issues.


### Disclaimer

This project is not affiliated to, nor endorsed by, reMarkable AS. **I assume no responsibility for any damage done to your device due to the use of this software.**

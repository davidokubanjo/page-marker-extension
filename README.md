# page-marker-extension
Custom Google Chrome Plugin to pin part of a webpage for reference in real time

- To use this Custom Google Chrome Extension. Download the page-marker-extension folder in this repository

- Open Google Chrome and go to chrome://extensions/ > Toggle Developer mode on (top-right) > Click "Load unpacked" > Select the page-marker-extension folder


## Logic Behind how this works

- You click the toolbar icon >
        
        - popup.html shows the panel
        - popup.js powers its buttons >
        
                - popup.js sends a message to → content.js
                                (which lives inside the webpage)
                                draws lines, scrolls, shows HUD

- Your keyboard shortcut hits → background.js
                                which forwards it to → content.js

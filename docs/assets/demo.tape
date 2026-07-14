# Renders docs/assets/demo.gif — the terminal capture embedded in the README.
#
# Requires VHS (https://github.com/charmbracelet/vhs):
#   vhs docs/assets/demo.tape
#
# The TUI is interactive, so the key sequence below is a starting point —
# adjust the navigation to showcase: nodes screen → VMs → plan/apply →
# station install. Keep it under ~30s; the README embeds it at 760px.

Output docs/assets/demo.gif

Set FontSize 15
Set Width 1280
Set Height 720
Set Padding 12
Set TypingSpeed 60ms

Type "devstation"
Enter
Sleep 5s

# navigate: open the demo topology
Enter
Sleep 3s

# tab through nodes / provisioning
Right
Sleep 3s
Left
Sleep 2s

# open a node → virtual machines
Enter
Sleep 4s

# open a VM detail (charts)
Enter
Sleep 5s

Escape
Sleep 2s

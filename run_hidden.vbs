""" VBScript: run_hidden.vbs
' Usage:
'   cscript //nologo run_hidden.vbs "C:\chemin\vers\script.ps1" [arg1 arg2 ...]
'
' Lance un script PowerShell en fenêtre cachée (ne bloque pas le lanceur).
"""
Set sh = CreateObject("WScript.Shell")
If WScript.Arguments.Count = 0 Then
    WScript.Echo "Usage: run_hidden.vbs ""C:\path\to\script.ps1"" [args]"
    WScript.Quit 1
End If

scriptPath = WScript.Arguments(0)
args = ""
For i = 1 To WScript.Arguments.Count - 1
    args = args & " " & Chr(34) & WScript.Arguments(i) & Chr(34)
Next

cmd = "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " & Chr(34) & scriptPath & Chr(34) & args
sh.Run cmd, 0, False

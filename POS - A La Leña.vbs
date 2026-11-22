Option Explicit

Dim shell, fso, scriptDir, batPath, cmd
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
' Usar ChrW(241) para la letra "n con tilde" evitando problemas de codificacion ANSI/UTF-8 en WScript
batPath = scriptDir & "\POS - A La Le" & ChrW(241) & "a.bat"

If Not fso.FileExists(batPath) Then
    MsgBox "No se encontro el archivo lanzador: " & batPath, vbCritical, "POS - A La Lena"
    WScript.Quit 1
End If

cmd = "cmd.exe /c """"" & batPath & """ --silent"""
shell.Run cmd, 0, False

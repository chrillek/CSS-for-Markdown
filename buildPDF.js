(()=> {
  const app = Application("DEVONthink 3");
  const args = $.NSProcessInfo.processInfo.arguments;
  const pathToDirectory = (args.count == 7) ? args.js[4].js : null;
  if (!pathToDirectory) throw "Must pass directory name on command line"
  const mdName = args.js[5].js;
  const targetDirectory = args.js[6].js;
  app.logMessage(`path: '${pathToDirectory}'\nmdName: '${mdName}'\ntargetDir: '${targetDirectory}'`);
   /* import path into new group in the global inbox */
  const mdGroup = app.import(pathToDirectory);
  app.logMessage('imported')
  const mdFile = app.search(`name:${mdName}`, {in: mdGroup});
  app.logMessage(`${mdFile.length} files found in Group`);
  if (mdFile.length !== 1) throw `File '${mdName}' not found in group '${mdGroup.name()}'`;
  const pdfFile = app.convert( {record: mdFile[0], to: "PDF document"});
  app.logMessage(`pdfFile created ${pdfFile.path()}`);
  app.export({record: pdfFile, to: targetDirectory});
  app.logMessage("pdfFile exported");
  app.delete({record: mdGroup});
  app.logMessage(`group ${mdGroup.name()} deleted`)
})()
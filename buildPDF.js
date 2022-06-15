(()=> {
  const app = Application("DEVONthink 3");
  const args = $.NSProcessInfo.processInfo.arguments;
  const pathToDirectory = (args.count == 7) ? args.js[4].js : null;
  if (!pathToDirectory) throw "Must pass directory name on command line"
  const mdName = args.js[5].js;
  const targetDirectory = args.js[6].js;
  const mdGroup = app.import(pathToDirectory) /* import path into new group in the global inbox */
  const mdFile = app.search(`name: ${mdName}`, {in: mdGroup});
  if (mdFile.length === 1) throw `File '${mdName}' not found in group '${mdGroup}'`;
  const pdfFile = app.convert( {record: mdFile[0], to: "PDF document"});
  app.export({record: pdfFile, to: targetDirectory});
  app.delete({record: mdGroup});
})()
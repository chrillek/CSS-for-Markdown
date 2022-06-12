(()=> {
  const app = Application("DEVONthink 3");
  const args = $.NSProcessInfo.processInfo.arguments;
  const pathToDirectory = (args.count == 7) ? args.js[4].js : null;
  if (!pathToDirectory) throw "Must pass directory name on command line"
  const mdName = args.js[5].js;
  const targetDirectory = args.js[6].js;
  const mdGroup = app.import(Path(pathToDirectory)) /* import path into new group in the global inbox */
  const mdFile = app.search(`filename: ${mdName}`, {in: mdGroup});
  const pdfFile = app.convert( mdFile, {to: "PDF document"});
  app.export({record: pdfFile}, {to: targetDirectory});
  app.delete({record: mdGroup});
})()
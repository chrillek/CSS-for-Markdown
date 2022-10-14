/* 
  Script used by GitHub to create a PDF of the MD document. Run in the pre-commit-hook at ../../githooks, uses DEVONthink to create the PDF
  arguments: path to directory to import
             name of the Markdown file
             targetDirectory for the PDF file
*/
(()=> {
  const app = Application("DEVONthink 3");
  const args = $.NSProcessInfo.processInfo.arguments;
  /* Get the path to the directory to import into DT */
  const pathToDirectory = (args.count == 7) ? args.js[4].js : null;
  if (!pathToDirectory) throw "Must pass directory name on command line"

  const mdName = args.js[5].js;
  const targetDirectory = args.js[6].js;
   /* import path into new group in the Test DB - prevents sync to other devices*/
  const mdGroup = app.import(pathToDirectory, {to: app.databases.Test.root()});
  /* Locate the MD file */
  const mdFile = app.search(`name:${mdName} kind:markdown`, {in: mdGroup});
  if (mdFile.length !== 1) throw `File '${mdName}' not found in group'`;
  /* Convert MD to PDF */
  const pdfFile = app.convert( {record: mdFile[0], to: "PDF document"});
  /* Export the PDF to the target dir */
  app.export({record: pdfFile, to: targetDirectory});
  /* Delete the group again –– seems not to work? */
  app.delete({record: mdGroup});
})()

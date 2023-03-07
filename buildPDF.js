/* 
  Script used by GitHub to create a PDF of the MD document. Run in the pre-commit-hook at ../../githooks, uses DEVONthink to create the PDF
  arguments: path to directory to import
             name of the Markdown file
             targetDirectory for the PDF file
*/

ObjC.import('PDFKit');
ObjC.import('CoreGraphics');
ObjC.import('AppKit');

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
  build_TOC(mdFile[0], pdfFile);
  /* Export the PDF to the target dir */
  app.export({record: pdfFile, to: targetDirectory});
  /* Delete the group again –– seems not to work? */
 // app.delete({record: mdGroup});
})()




function buildTOC(mdRecord, pdfRecord) {
  const TOCHeader = "Table of content"; // That's what MultiMarkdown inserts, because it has no idea of L10N

  /* Class to handle insertion of TOC entries into the correct level of the tree */

  class tableOfContents {
  
  constructor(topLevel) {
    this.topLevel = this.lastParent = topLevel;
    this.lastLevel = -1;
    this.lastSibling = this.lastParent = undefined;
  }
  
  getTopLevel() {
    return this.topLevel;
  }
  
  addEntry(title, currentLevel, destination) {
  //  console.log(`Adding "${title}" to TOC for level ${currentLevel}`)
  //  console.log(`lastLevel: ${this.lastLevel}`);
    const tocEntry = $.PDFOutline.alloc.init;
    tocEntry.destination = destination;
    
    /* Use the heading in the PDF doc as label for the TOC entry */
    tocEntry.label = $(title);
    /* Find the appropraite parent PDFOutline to append this TOC entry to */
    const parentOutline = (() => {
      /* Current heading is bigger than last one: append to last one or outline for first heading */
      if (currentLevel > this.lastLevel) 
        return this.lastSibling || this.topLevel;
      /* Current heading is on same level as last one: append to parent of last sibling */
      if (currentLevel === this.lastLevel)
        return this.lastSibling.parent;
      /* Current heading is smaller than last one: move upwards to find matching parent */
      let targetLevel = this.lastLevel;
      let targetEntry = this.lastParent || this.topLevel;
      while (targetLevel > currentLevel) {
        targetEntry = targetEntry.parent || this.topLevel;
        targetLevel--;
      }
      return targetEntry;
    })()
    parentOutline.insertChildAtIndex(tocEntry, parentOutline.numberOfChildren);
//    console.log(`Inserting in ${parentOutline ? parentOutline.label.js : 'toplevel'}`);
    this.lastLevel = currentLevel;
    this.lastParent = tocEntry.parent;
    this.lastSibling = tocEntry;
    //  console.log(`Final lastLevel: ${this.lastLevel}`);
  }
}

  const app = Application("DEVONthink 3")
  
  const txt = mdRecord.plainText();
  if (!/\{\{TOC}}/.test(txt)) {
    console.log("No TOC command in MD file.")
  }
  /* Find headings in MD file, skipping over code fences.
  The replace() removes all code fences, the matchAll greps all headlines and the map extracts the captured headline,
  i.e. the "#[#…] Headling".
  The array headings than contains only those strings. 
  */
  const headings = [... 
    txt.replaceAll(/^```.*?```$/smg,'').
    matchAll(/^(#+\s+.*?)$/smg)].
  map(h => h[1]);
  
  /* Convert the MD to PDF, get the PDFDocument from it and create the top-level Outline */
 
  const pdfDoc = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath($(pdfRecord.path())));
  const outline = $.PDFOutline.alloc.init;
  
  const TOC = new tableOfContents(outline); // Create TOC object
  
  /* Get the text layer of the PDF as JavaScript string */
  const pdfText = pdfDoc.string.js;
  const pdfTOCBox = pdfText.includes(TOCHeader)  
    ? getTOCBox(pdfDoc, headings.at(-1).replace(/^#+\s+/,'')) 
    : undefined;
  /* Loop over all headlines from the MD document */
  headings.forEach(h => {
    /* Calculate the headline level from the number of leading '#' characters */
    const currentLevel = h.match(/^#+/m)[0].length;
    /* Remove the leading hash signs and space(s) from headline (first replace), and
    escape characters with special meaning in regular expressions (2nd replace) */
    const cleanedHeading = h.replace(/^#+\s+/,'').replaceAll(/([+*?\[\-{}])/g,"\\$1");
    
    /* Build a regular expression from the current headline 
       matching the headline at the start or end of the line.
       That finds a maximum of _two_ headlines per physical line. */
    const headingRE = new RegExp(`(^${cleanedHeading}|${cleanedHeading}$)`,"m");
    /* Find the headline in the PDF as it's printed there. 
    It might be prefixed with characters _not_ in the original one, like numbering */
    const headingInPDF = pdfText.match(headingRE);
    if (!headingInPDF) {
      console.log(`"${cleanedHeading}" not found in PDF`);
      return;
    }
  //  console.log(`${h} => "${headingInPDF[1]})"`); 
    /* If the heading is found ... (well, it should always be, but who konws) */
    if (headingInPDF) {
      /* Search for the textual version of the headline in the PDFDocument to find page and location on page */
      const currentHeader = headingInPDF[1];
      const pdfSelection = $.NSMutableArray.arrayWithArray(pdfDoc.findStringWithOptions($(currentHeader),0));
      
      /* If the text is found (as it should be), find the matches in the TOC area and the PDF proper */
      console.log(`${cleanedHeading} found ${pdfSelection.js.length} times.`);
      if (pdfSelection.js.length > 0) {
        const TOCMatch = findTOCMatch(pdfSelection, pdfTOCBox);
        pdfSelection.removeObject(TOCMatch);
        const contentMatch = (() => {
          if (pdfSelection.js.length === 1) {
            return pdfSelection.js[0];
          } else {
            return findContentMatch(pdfSelection, pdfTOCBox);
          }
        })()
        if (contentMatch) {
          /* Add entry to TOC in PDF metadata */
          const contentDestination = createDestination(contentMatch);
    //      console.log(`Adding ${currentHeader} to TOC`);
          TOC.addEntry(currentHeader, currentLevel, contentDestination);
          if (TOCMatch) {
            // Add clickable annotation to visible TOC in PDF
            const annotation = createLinkAnnotation(TOCMatch, contentDestination)
          }
        } else {
          console.log(`No contentMatch for ${currentHeader}`);
          return;
        }
      } else {
        console.log(`pdfSelection is empty for ${currentHeader}`);
        return;
      }
    }
  })
  /* Save the outline in the PDF document and save the document to disk */
  pdfDoc.setOutlineRoot(outline);
  pdfDoc.writeToFile(pdfRecord.path());
}


function getTOCBox(pdfDoc, lastHeading) {
  //  console.log(lastHeading);
  const TOCHeaderSelection = pdfDoc.findStringWithOptions($(TOCHeader), 0).js[0];
  const lastHeaderSelection = pdfDoc.findStringWithOptions($(lastHeading), 0).js[0];
  const TOCPage = TOCHeaderSelection.pages.js[0];
  const lastHeaderPage = lastHeaderSelection.pages.js[0];
  const unionBox = $.NSUnionRect(TOCHeaderSelection.boundsForPage(TOCPage), lastHeaderSelection.boundsForPage(lastHeaderPage));
  return {bounds: unionBox, page: TOCPage};
}

/* Return the first selection which lies on the same page as the TOC 
   and whose bounding box intersects the TOC bounding box  */
function findTOCMatch(selection, TOCInfo) {
  const TOCPage = TOCInfo.page;
  const TOCPageNo = $.CGPDFPageGetPageNumber(TOCPage.pageRef);
  const TOCBox = TOCInfo.bounds;
  for (let i = 0; i < selection.js.length; i++) {
    const s = selection.js[i];
    const pages = s.pages.js;
    const pageIndex = pages.findIndex(e => {
      return $.CGPDFPageGetPageNumber(e.pageRef) === TOCPageNo;
    });
    if (pageIndex > -1 && $.NSIntersectsRect(s.boundsForPage(TOCPage), TOCBox)) {
      return s;
    }
  }
  return null;
}

/* Return the first selection for which the intersection of its bounding box
   on the TOC page with the TOC bounding box is empty.
   In that case the selection is either on another page as the TOC or 
   on the same page but doesn't lie _in_ the TOC 
*/
function findContentMatch(selection,TOCInfo) {
  const TOCPage = TOCInfo.page;
  const TOCBox  = TOCInfo.bounds;
  for (let i = 0; i < selection.js.length; i++) {
    const s = selection.js[i];
    //  console.log(pageIndex);
    if (!$.NSIntersectsRect(s.boundsForPage(TOCPage), TOCBox)) {
      //  console.log(`Match ${i}`)
      return s;
    }
  }
  return null;
}

/* Build a PDFDestination object from a PDFSelection and return it */
function createDestination(selection) {
  const page = selection.pages.js[0]; // NSPage object!
  const bounds = selection.boundsForPage(page); //NSRect object
  /* Calculate the point for the destination clicking on the TOC entry is moving to. 
  Use the upper y coordinate and the left x coordinate */
//  const pt = $.NSPointFromCGPoint($.NSRectToCGRect(bounds).origin);
  const pt = bounds.origin;
  pt.y = $.NSMaxY(bounds);
  
  /* Create a new PDFDestination, i.e. a target for the TOC entry */
  return $.PDFDestination.alloc.initWithPageAtPoint(page, pt);
}

/* Add a link annotation to "source", pointing to "destination" */
function createLinkAnnotation(source, destination) {
  const page = source.pages.js[0]; /* assuming the source is completely on one page */
  const bounds = source.boundsForPage(page);
  const annotation = $.PDFAnnotation.alloc.initWithBoundsForTypeWithProperties(bounds,$.PDFAnnotationSubtypeLink, {});
  annotation.destination = destination;
  page.addAnnotation(annotation);
}
import singleSpaHtml from "single-spa-html"; // single-spa lifecycles helper
import template from "./template.html"; // separate html template provides better syntax highlighting
import styles from "./styles.css"; // CSS Modules; pitfall: ensure that your CSS is scoped else they will be *global*

const ONE_MINUTE = 60000;

// Use CSS modules in html template by interpolating them
const interpolateTemplate = () => {
  const cssModuleClassNames = Object.keys(styles).join("|");
  const classNamesRegex = new RegExp(cssModuleClassNames, "gi");
  const templateWithClassNames = template.replace(
    classNamesRegex,
    (matched) => styles[matched]
  );
  return templateWithClassNames;
};

const htmlLifecycles = singleSpaHtml({
  domElementGetter: () => {
    const id = "@ml/navbar";
    let container = document.getElementById(id);
    if (!container) {
      container = document.createElement("div");
      container.id = id;
      container.classList += "flex-top flex-block";
      document.body.prepend(container); // single-spa automatically _appends_, but this content should be _prepended_ for accessibility
    }
    return container;
  },
  template: interpolateTemplate(),
});

/*
This seems complicated so let's break it down:
1. this mount function will be used by single-spa as part of the application lifecycle
2. it wraps htmlLifecycles.mount to in order to conditionally render the html (based on prior consent);
  this may not be needed for many applications! If instead always mount the same content this
  could instead be implemented as `export const mount = [htmlLifecycles.mount, myOtherMountFn]`
3. If no prior consent, then await the original mount function and bind behaviors the interactive elements
*/
export const mount = async (props) => {
  // uses localStorage for convenience but could be anything to check.
  // for example, this could be implemented with cookies if you wanted to send it back and forth to your server
 
  await htmlLifecycles.mount(props); // wait for single-spa to mount the application

};

export const { bootstrap, unmount } = htmlLifecycles; // export other lifecycles as-is

/* Nav component */

// ListItem is what we get back from the API list call.
interface ListItem {
  Name: string;
  IsDir: boolean;
  Size: number;
  ModTime: number;      // seconds since the epoch
  ModTimeStr: string;   // ModTime converted to string in the server
  Text: string;
  TextError: string;
}

interface ListResponse {
  Items: ListItem[];
}

// NavItem is what we maintain locally for our nav list.
interface NavItem {
  path: string;         // Full path to the this item
  name: string;         // Final component of the path
  level: number;
  expanded: boolean;
  isDir: boolean;
  size: number;
  modTime: number;
  modTimeStr: string;
  text: string;
  textError: string;
}

class KeyFunc {
  desc: string;
  f: () => void;
}

@Polymer.decorators.customElement('mim-nav')
class MimNav extends Polymer.Element {

  @Polymer.decorators.property({type: String, notify: true})
  imgsrc: string;

  @Polymer.decorators.property({type: Object})
  imgsize: any;

  @Polymer.decorators.property({type: Array})
  rows: NavItem[] = [];

  @Polymer.decorators.property({type: Number})
  selectedIndex: number;

  keyMap: {[key: string]: KeyFunc};

  ready() {
    super.ready();
    this.initKeyMap();
    this.queryApiList('');
  }

  async queryApiList(dir: string) {
    const listUrl = "/api/list/" + dir;
    const response = await ApiManager.xhrJson(listUrl);
    this.handleListResponse(dir, response);
  }

  handleListResponse(dir: string, list: ListResponse) {
    const navItems = list.Items.map(
        (listItem) => this.listToNav(listItem, dir));
    this.updateDirRows(dir, navItems);
  }

  listToNav(listItem: ListItem, dir: string): NavItem {
    const level = dir.split('/').length;
    const path = dir + '/' + listItem.Name;
    return {
      path,
      name: listItem.Name,
      level,
      expanded: false,
      isDir: listItem.IsDir,
      size: listItem.Size,
      modTime: listItem.ModTime,
      modTimeStr: listItem.ModTimeStr,
      text: listItem.Text,
      textError: listItem.TextError,
    } as NavItem;
  }

  updateDirRows(dir: string, rows: NavItem[]) {
    if (!dir) {
      this.rows = rows;
      return;
    }
    // We are updating in the middle somewhere, look for our dir,
    // replace its children with the new items, and expand it.
    const index = this.rows.findIndex((row) => row.path == dir);
    if (index < 0) {
      console.error("Can't find entry for dir", dir);
      return;
    }
    const nextIndex = this.nextIndex(index);
    const updatedRows = this.rows.slice(0, index + 1)
      .concat(rows)
      .concat(this.rows.slice(nextIndex, this.rows.length));
    this.rows = updatedRows;
    this.rows[index].expanded = true;
  }

  // Looks at the level of the row at the specified index and returns the
  // index of the first following row with the same or lower level,
  // otherwise the length of the rows list.
  nextIndex(index: number) {
    const rowLevel = this.rows[index].level;
    let nextIndex = this.rows.findIndex((row, i) => {
      if (i <= index) {
        return false;
      }
      if (row.level <= rowLevel) {
        return true;
      }
      return false;
    });
    if (nextIndex < 0) {
      nextIndex = this.rows.length;
    }
    return nextIndex;
  }

  collapseRowAt(index: number) {
    const nextIndex = this.nextIndex(index);
    const updatedRows = this.rows.slice(0, index + 1)
      .concat(this.rows.slice(nextIndex, this.rows.length));
    this.rows = updatedRows;
    this.rows[index].expanded = false;
  }

  getRowClass(row: NavItem, selectedIndex: number) {
    let classList = ['nav-item'];
    if (row.isDir) {
      classList.push('dir');
    }
    const rowIndex = this.rows.indexOf(row);
    if (rowIndex >= 0) {
      if (rowIndex === selectedIndex) {
        classList.push('selected');
      }
    }
    return classList.join(' ');
  }

  indentsForRow(row: NavItem) {
    return new Array(row.level);
  }

  sizeAsString(row: NavItem) {
    if (row.size <= 999) {
      return row.size + "B";
    }
    if (row.size <= 9999) {
      return Math.round(row.size/10)/100 + "K";
    }
    if (row.size <= 99999) {
      return Math.round(row.size/100)/10 + "K";
    }
    if (row.size <= 999999) {
      return Math.round(row.size/1000) + "K";
    }
    if (row.size <= 9999999) {
      return Math.round(row.size/10000)/100 + "M";
    }
    if (row.size <= 99999999) {
      return Math.round(row.size/100000)/10 + "M";
    }
    return Math.round(row.size/1000000) + "M";
  }

  rowClicked(e: any) {
    this.selectAt(e.model.index);
  }

  selectAt(index: number) {
    this.selectedIndex = index;
    const row = this.rows[index];
    const rowElements = this.$.listContainer.querySelectorAll('.nav-item');
    const rowElement = rowElements[index];
    if (rowElement.offsetTop < this.scrollTop) {
      rowElement.scrollIntoView(true);
    } else if (rowElement.offsetTop + rowElement.offsetHeight > this.scrollTop + this.offsetHeight) {
      rowElement.scrollIntoView(false);
    }
    if (row.isDir) {
      this.setImageSource('');
      if (row.expanded) {
        this.collapseRowAt(index);
      } else {
        this.queryApiList(row.path);
      }
    } else {
      this.setImageSource(row.path);
    }
  }

  selectNext() {
    if (this.selectedIndex >= 0 &&
        this.selectedIndex < this.rows.length - 1 &&
        this.rows[this.selectedIndex + 1].level === this.rows[this.selectedIndex].level) {
      this.selectAt(this.selectedIndex + 1);
    }
  }

  selectPrevious() {
    if (this.selectedIndex > 0 &&
        this.selectedIndex < this.rows.length &&
        this.rows[this.selectedIndex - 1].level === this.rows[this.selectedIndex].level) {
      this.selectAt(this.selectedIndex - 1);
    }
  }

  showKeyBindings() {
    var keys = [];
    for (var key in this.keyMap) {
      if (this.keyMap.hasOwnProperty(key)) {
        keys.push(key);
      }
    }
    keys.sort();
    const helpString = keys.map((key: any) => {
      const entry = this.keyMap[key];
      return key + ": " + entry.desc + "<br>";
    }).join('\n');
    this.showDialogHtml(helpString);
  }

  initKeyMap() {
    this.keyMap = {};
    this.addKey('ArrowDown', 'Display the next image',
        this.selectNext.bind(this));
    this.addKey('ArrowUp', 'Display the previous image',
        this.selectPrevious.bind(this));
    this.addKey('?', 'List key bindings',
        this.showKeyBindings.bind(this));
  }

  addKey(key: string, desc: string, f: () => void) {
    const keyFunc = new KeyFunc();
    keyFunc.desc = desc;
    keyFunc.f = f;
    this.keyMap[key] = keyFunc;
  }

  onMimKey(e: any) {
    console.log('nav mimkey', e);
    const key = e.detail.key;
    const keyFunc = this.keyMap[key];
    if (keyFunc) {
      keyFunc.f();
    }
  }

  @Polymer.decorators.observe('imgsize')
  imgsizeChanged() {
    if (this.selectedIndex >= 0) {
      const row = this.rows[this.selectedIndex];
      if (!row.isDir) {
        this.selectAt(this.selectedIndex);
      }
    }
  }

  setImageSource(src: string) {
    let qParms = '';
    if (this.imgsize) {
      const height = this.imgsize.height;
      const width = this.imgsize.width;
      qParms = '?w=' + width + '&h=' + height;
    }
    if (src) {
      this.imgsrc = "/api/image" + src + qParms;
    } else {
      this.imgsrc = '';
    }
  }

  showDialogHtml(html: string) {
    const detail = {html: html};
    this.dispatchEvent(new CustomEvent('mimdialog', {detail: detail}));
  }

  showDialog(msg: string) {
    const detail = {message: msg};
    this.dispatchEvent(new CustomEvent('mimdialog', {detail: detail}));
  }
}

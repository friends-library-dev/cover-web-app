import React from 'react';
import cx from 'classnames';
import KeyEvent from 'react-keyboard-event-handler';
import { CoverProps } from '@friends-library/types';
import FormControl from '@material-ui/core/FormControl';
import {
  Front,
  ThreeD,
  PrintPdf,
  LogoEnglish,
  LogoSpanish,
  css as coverCss,
} from '@friends-library/cover-component';
import debounce from 'lodash/debounce';
import { FriendData, DocumentData, EditionData } from '../types';
import { friendData, editions, documents, scalerAndScope } from './utils';
import Select from './Select';
import Toolbar from './Toolbar';
import CodeEditor from './CodeEditor';
import './App.css';

type Perspective = 'front' | 'spine' | 'back' | 'angle-front' | 'angle-back';
export type Scale = 'fit' | '1' | '1-4' | '1-3' | '1-2' | '4-5' | '3-5';
export type Mode = 'pdf' | '3d' | 'ebook';
export type BookSize = 'actual' | 's' | 'm' | 'xl';

interface State {
  friendIndex: number;
  docIndex: number;
  edIndex: number;
  scale: Scale;
  showGuides: boolean;
  maskBleed: boolean;
  showCode: boolean;
  mode: Mode;
  bookSize: BookSize;
  fauxVol?: 1 | 2;
  perspective: Perspective;
  capturing: 'ebook' | 'audio' | `threeD` | null;
  customBlurbs: Record<string, string>;
  customHtml: Record<string, string>;
  customCss: Record<string, string>;
}

export default class App extends React.Component<Record<string, never>, State> {
  public override state: State = {
    friendIndex: 0,
    docIndex: 0,
    edIndex: 0,
    bookSize: `actual`,
    scale: `1`,
    showGuides: false,
    showCode: false,
    maskBleed: true,
    mode: `3d`,
    capturing: null,
    fauxVol: undefined,
    perspective: `angle-front`,
    customBlurbs: {},
    customCss: {},
    customHtml: {},
  };

  public override componentDidMount(): void {
    try {
      const stored = JSON.parse(sessionStorage.getItem(`state`) || `null`);
      this.setState({ ...this.state, ...stored });
    } catch {
      // ¯\_(ツ)_/¯
    }

    window.addEventListener(`resize`, () => this.forceUpdate());
    window.addEventListener(`beforeunload`, () => {
      sessionStorage.setItem(`state`, JSON.stringify(this.state));
    });

    const query = new URLSearchParams(window.location.search);
    const capturing = query.get(`capture`);
    if (capturing === `ebook` || capturing === `audio`) {
      this.setState({ capturing, mode: `ebook`, scale: `1` });
    } else if (capturing === `threeD`) {
      this.setState({ capturing, mode: `3d`, scale: `1`, bookSize: `m` });
    } else {
      this.setState({ capturing: null });
    }
    if (query.has(`path`)) {
      this.setState(this.selectCover(query.get(`path`) || ``));
    }
  }

  protected selectCover(path: string): {
    friendIndex: number;
    docIndex: number;
    edIndex: number;
  } {
    for (let friendIndex = 0; friendIndex < friendData.length; friendIndex++) {
      const friend = friendData[friendIndex]!;
      for (let docIndex = 0; docIndex < friend.documents.length; docIndex++) {
        const doc = friend.documents[docIndex]!;
        for (let edIndex = 0; edIndex < doc.editions.length; edIndex++) {
          const ed = doc.editions[edIndex]!;
          if (ed.path === path) {
            return {
              friendIndex,
              docIndex,
              edIndex,
            };
          }
        }
      }
    }
    throw new Error(`Cover with path: ${path} not found`);
  }

  protected selectedEntities(): {
    friend?: FriendData;
    doc?: DocumentData;
    ed?: EditionData;
  } {
    const { friendIndex, docIndex, edIndex } = this.state;
    if ([friendIndex, docIndex, edIndex].map(Number).includes(-1)) {
      return {};
    }
    const friend = friendData[friendIndex];
    if (!friend) return {};
    const doc = friend.documents[docIndex];
    if (!doc) return { friend };
    const ed = doc.editions[edIndex];
    if (!ed) return { friend, doc };
    return { friend, doc, ed };
  }

  protected coverProps(): CoverProps | undefined {
    const { showGuides, mode, bookSize, scale, showCode, fauxVol, capturing } =
      this.state;
    const { friend, doc, ed } = this.selectedEntities();
    if (!friend || !doc || !ed) return;
    const size = mode === `ebook` ? `xl` : bookSize === `actual` ? ed.size : bookSize;
    return {
      author: friend.name,
      lang: doc.lang,
      title: doc.title,
      isCompilation: doc.isCompilation,
      size: mode === `ebook` ? `xl` : bookSize === `actual` ? ed.size : bookSize,
      pages: Math.max(ed.pages, capturing === `threeD` ? 75 : 0),
      edition: ed.type,
      blurb: this.getBlurb(friend, doc),
      isbn: ed.isbn,
      showGuides,
      customCss: this.getCustomCss(),
      customHtml: this.getCustomHtml(),
      fauxVolumeNum: fauxVol,
      ...scalerAndScope(size, ed.pages, scale, mode, showCode),
      ...(capturing === `threeD` ? { scaler: 2, scope: `2x` } : {}),
    };
  }

  protected getBlurb(friend: FriendData, doc: DocumentData): string {
    const key = this.coverKey();
    const { customBlurbs } = this.state;
    if (customBlurbs[key] !== undefined) return customBlurbs[key] ?? `TODO`;
    return doc.description || friend.description || `TODO`;
  }

  protected getCustomCss(): string {
    const key = this.documentKey();
    if (this.state.customCss[key] !== undefined) {
      return this.state.customCss[key] ?? ``;
    }
    const { doc } = this.selectedEntities();
    return doc && doc.customCss ? doc.customCss : ``;
  }

  protected getCustomHtml(): string {
    const key = this.documentKey();
    if (this.state.customHtml[key] !== undefined) {
      return this.state.customHtml[key] ?? ``;
    }
    const { doc } = this.selectedEntities();
    return doc && doc.customHtml ? doc.customHtml : ``;
  }

  protected updateCustomCss(css: string): void {
    this.setState({
      customCss: {
        ...this.state.customCss,
        [this.documentKey()]: css,
      },
    });
  }

  protected updateCustomHtml(html: string): void {
    this.setState({
      customHtml: {
        ...this.state.customHtml,
        [this.documentKey()]: html,
      },
    });
  }

  protected documentKey(): string {
    const { friend, doc } = this.selectedEntities();
    if (!friend || !doc) return `[[none]]`;
    return `${friend.name}${doc.title}`;
  }

  protected coverKey(): string {
    const { friend, doc, ed } = this.selectedEntities();
    if (!friend || !doc || !ed) return `[[none]]`;
    return `${friend.name}${doc.title}${ed.type}`;
  }

  protected spinCover: () => void = () => {
    const { perspective } = this.state;
    const next: { [k in Perspective]: Perspective } = {
      front: `angle-front`,
      'angle-front': `spine`,
      spine: `angle-back`,
      'angle-back': `back`,
      back: `front`,
    };
    this.setState({ perspective: next[perspective] });
  };

  public changeCover(dir: Direction): void {
    const { friendIndex, docIndex, edIndex } = this.state;
    const friend = friendData[friendIndex];
    if (!friend) {
      this.setState({ friendIndex: 0, docIndex: 0, edIndex: 0 });
      return;
    }

    const doc = friend.documents[docIndex];
    if (!doc) {
      this.setState({ docIndex: 0, edIndex: 0 });
      return;
    }

    const ed = doc.editions[edIndex];
    if (!ed) {
      this.setState({ edIndex: 0 });
      return;
    }

    if (dir === FORWARD) {
      if (edIndex < doc.editions.length - 1) {
        this.setState({ edIndex: edIndex + 1 });
      } else if (docIndex < friend.documents.length - 1) {
        this.setState({ docIndex: docIndex + 1, edIndex: 0 });
      } else if (friendIndex < friendData.length - 1) {
        this.setState({ friendIndex: friendIndex + 1, docIndex: 0, edIndex: 0 });
      } else {
        this.setState({ friendIndex: 0, docIndex: 0, edIndex: 0 });
      }
      return;
    }

    if (edIndex > 0) {
      this.setState({ edIndex: edIndex - 1 });
    } else if (docIndex > 0) {
      this.setState({
        docIndex: docIndex - 1,
        edIndex: friend.documents[docIndex - 1]!.editions.length - 1,
      });
    } else if (friendIndex > 0) {
      const newDocs = friendData[friendIndex - 1]!.documents;
      this.setState({
        friendIndex: friendIndex - 1,
        docIndex: newDocs.length - 1,
        edIndex: newDocs[newDocs.length - 1]!.editions.length - 1,
      });
    } else {
      const lastFriendIndex = friendData.length - 1;
      const lastFriendDocs = friendData[lastFriendIndex]!.documents;
      const lastDocIndex = lastFriendDocs.length - 1;
      const lastDoc = lastFriendDocs[lastDocIndex]!;
      this.setState({
        friendIndex: lastFriendIndex,
        docIndex: lastDocIndex,
        edIndex: lastDoc.editions.length - 1,
      });
    }
  }

  public changeFriend(dir: Direction): void {
    const { friendIndex } = this.state;

    // prettier-ignore
    const next = dir === FORWARD
      ? friendIndex === friendData.length - 1 ? 0 : friendIndex + 1
      : friendIndex === 0 ? friendData.length - 1 : friendIndex - 1;

    this.setState({
      friendIndex: next,
      docIndex: 0,
      edIndex: 0,
    });
  }

  public changeDocument(dir: Direction): void {
    const { friendIndex, docIndex } = this.state;
    const docs = documents(friendIndex);
    if (docs.length < 1) {
      return;
    }

    // prettier-ignore
    const next = dir === FORWARD
      ? docIndex === docs.length - 1 ? 0 : docIndex + 1
      : docIndex === 0 ? docs.length - 1 : docIndex - 1

    this.setState({
      docIndex: next,
      edIndex: 0,
    });
  }

  public changeEdition(dir: Direction): void {
    const { friendIndex, docIndex, edIndex } = this.state;
    const docs = documents(friendIndex);
    if (docs.length < 1) {
      return;
    }

    const eds = editions(friendIndex, docIndex);
    if (eds.length < 1) {
      return;
    }

    // prettier-ignore
    const next = dir === FORWARD
      ? edIndex === eds.length - 1 ? 0 : edIndex + 1
      : edIndex === 0 ? eds.length - 1 : edIndex - 1

    this.setState({
      edIndex: next,
    });
  }

  public override render(): JSX.Element {
    const {
      friendIndex,
      docIndex,
      edIndex,
      scale,
      showGuides,
      maskBleed,
      perspective,
      showCode,
      mode,
      capturing,
      fauxVol,
      bookSize,
    } = this.state;
    const coverProps = this.coverProps();

    return (
      <div
        className={cx(`App`, `web`, {
          [`trim--${coverProps ? coverProps.size : `m`}`]: true,
          'capturing-screenshot': capturing !== null,
          'capturing-audio': capturing === `audio`,
          'capturing-3d': capturing === `threeD`,
          'has-custom-code': this.getCustomCss() || this.getCustomCss(),
        })}
      >
        <KeyEvent handleKeys={[`right`]} onKeyEvent={() => this.changeCover(FORWARD)} />
        <KeyEvent handleKeys={[`left`]} onKeyEvent={() => this.changeCover(BACKWARD)} />
        <KeyEvent handleKeys={[`f`]} onKeyEvent={() => this.changeFriend(FORWARD)} />
        <KeyEvent
          handleKeys={[`esc`]}
          onKeyEvent={() =>
            this.setState({
              customBlurbs: {},
              customCss: {},
              customHtml: {},
            })
          }
        />
        <KeyEvent
          handleKeys={[`shift+f`]}
          onKeyEvent={() => this.changeFriend(BACKWARD)}
        />
        <KeyEvent
          handleKeys={[`up`, `d`]}
          onKeyEvent={() => this.changeDocument(FORWARD)}
        />
        <KeyEvent
          handleKeys={[`down`, `shift+d`]}
          onKeyEvent={() => this.changeDocument(BACKWARD)}
        />
        <KeyEvent
          handleKeys={[`pageup`, `e`]}
          onKeyEvent={() => this.changeEdition(FORWARD)}
        />
        <KeyEvent
          handleKeys={[`pagedown`, `shift+e`]}
          onKeyEvent={() => this.changeEdition(BACKWARD)}
        />
        <KeyEvent
          handleKeys={[`g`]}
          onKeyEvent={() => this.setState({ showGuides: !showGuides })}
        />
        <KeyEvent
          handleKeys={[`s`]}
          onKeyEvent={debounce(() => mode === `3d` && this.spinCover(), 250)}
        />
        <form autoComplete="off" style={{ padding: `1em 1em 0 1em`, display: `flex` }}>
          <FormControl style={{ minWidth: 200, marginRight: `1em` }}>
            <Select
              label="Friend"
              value={friendIndex}
              options={friendData.map((f) => f.alphabeticalName)}
              onChange={(e) => {
                this.setState({
                  friendIndex: Number(e.target.value),
                  docIndex: 0,
                  edIndex: 0,
                });
              }}
            />
          </FormControl>
          <FormControl style={{ flexGrow: 1, marginRight: `1em` }}>
            <Select
              label="Document"
              value={docIndex}
              options={documents(friendIndex).map((d) => d.title)}
              onChange={(e) => {
                this.setState({
                  docIndex: Number(e.target.value),
                  edIndex: 0,
                });
              }}
            />
          </FormControl>
          <FormControl style={{ minWidth: 140 }}>
            <Select
              label="Edition"
              value={edIndex}
              options={editions(friendIndex, docIndex).map((e) => e.type)}
              onChange={(e) => this.setState({ edIndex: Number(e.target.value) })}
            />
          </FormControl>
        </form>
        {!coverProps && <div style={{ flexGrow: 1 }} />}
        {coverProps && (
          <>
            <div className={cx(`cover-wrap`, { 'cover--ebook': mode === `ebook` })}>
              {capturing === `audio` && (
                <div className={`audio-logo audio-logo--${coverProps.lang}`}>
                  {coverProps.lang === `en` ? <LogoEnglish /> : <LogoSpanish />}
                </div>
              )}
              {mode === `3d` && <ThreeD {...coverProps} perspective={perspective} />}
              {mode === `pdf` && <PrintPdf {...coverProps} bleed={!maskBleed} />}
              {mode === `ebook` && <Front {...coverProps} />}
              <style>
                {coverCss.common(coverProps.scaler).join(`\n`)}
                {coverCss.front(coverProps.scaler).join(`\n`)}
                {coverCss.back(coverProps.scaler).join(`\n`)}
                {coverCss.spine(coverProps.scaler).join(`\n`)}
                {coverCss.guides(coverProps.scaler).join(`\n`)}
                {mode === `3d` ? coverCss.threeD(coverProps.scaler).join(`\n`) : ``}
                {mode === `pdf`
                  ? coverCss.pdf(coverProps, coverProps.scaler).join(`\n`)
                  : ``}
              </style>
            </div>
          </>
        )}
        {showCode && (
          <CodeEditor
            css={this.getCustomCss()}
            html={this.getCustomHtml()}
            updateCss={(css) => this.updateCustomCss(css)}
            updateHtml={(html) => this.updateCustomHtml(html)}
          />
        )}
        <Toolbar
          fauxVol={fauxVol}
          scale={scale}
          maskBleed={maskBleed}
          showGuides={showGuides}
          mode={mode}
          spinCover={this.spinCover}
          showCode={showCode}
          cycleFauxVol={() => {
            this.setState({
              fauxVol: fauxVol === 1 ? 2 : fauxVol === 2 ? undefined : 1,
            });
          }}
          cycleMode={() => {
            this.setState({
              mode: mode === `pdf` ? `3d` : mode === `3d` ? `ebook` : `pdf`,
            });
          }}
          toggleShowCode={() => this.setState({ showCode: !showCode })}
          cycleScale={() => {
            const map: Record<Scale, Scale> = {
              fit: `1`,
              '1': `1-2`,
              '1-2': `1-3`,
              '1-3': `1-4`,
              '1-4': `3-5`,
              '3-5': `4-5`,
              '4-5': `fit`,
            };
            this.setState({ scale: map[scale] });
          }}
          bookSize={bookSize}
          cycleBookSize={() => {
            const map: Record<BookSize, BookSize> = {
              actual: `s`,
              s: `m`,
              m: `xl`,
              xl: `actual`,
            };
            this.setState({ bookSize: map[bookSize] });
          }}
          toggleShowGuides={() => this.setState({ showGuides: !showGuides })}
          toggleMaskBleed={() => this.setState({ maskBleed: !maskBleed })}
          coverProps={coverProps}
        />
      </div>
    );
  }
}

type Direction = 'FORWARD' | 'BACKWARD';
const FORWARD = `FORWARD`;
const BACKWARD = `BACKWARD`;

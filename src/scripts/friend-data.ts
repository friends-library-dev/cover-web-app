import '@friends-library/env/load';
import * as fs from 'fs';
import { resolve } from 'path';
import { red } from 'x-chalk';
import exec from 'x-exec';
import env from '@friends-library/env';
import { Friend } from '@friends-library/friends';
import { allFriends } from '@friends-library/friends/query';
import { fetchSingleton, DocumentMeta } from '@friends-library/document-meta';
import { FriendData } from '../types';

const { DOCS_REPOS_ROOT: ROOT } = env.require(`DOCS_REPOS_ROOT`);

(async () => {
  const meta = await fetchSingleton();
  const data: FriendData[] = Object.values(
    allFriends()
      .filter((friend) => friend.hasNonDraftDocument)
      .reduce((acc, friend: Friend) => {
        if (!acc[friend.name]) {
          acc[friend.name] = {
            name: friend.name,
            description: friend.description,
            documents: [],
          };
        }
        acc[friend.name].documents = acc[friend.name].documents.concat(
          mapDocuments(friend, meta),
        );
        return acc;
      }, {} as { [k: string]: FriendData }),
  );

  const destPath = resolve(__dirname, `../friends.js`);
  fs.writeFileSync(destPath, `window.Friends = ${JSON.stringify(data)}`);
  exec(`prettier --write ${destPath}`);
})();

function mapDocuments(friend: Friend, meta: DocumentMeta): FriendData['documents'] {
  const documents = friend.documents.filter((doc) => doc.hasNonDraftEdition);
  return documents.map((document) => {
    const path = `${friend.lang}/${friend.slug}/${document.slug}`;
    const fullPath = `${ROOT}/${path}`;
    let customCss = null;
    let customHtml = null;

    if (fs.existsSync(`${fullPath}/paperback-cover.css`)) {
      customCss = fs.readFileSync(`${fullPath}/paperback-cover.css`).toString();
    }

    if (fs.existsSync(`${fullPath}/paperback-cover.html`)) {
      customHtml = fs.readFileSync(`${fullPath}/paperback-cover.html`).toString();
    }

    return {
      lang: friend.lang,
      title: document.title,
      description: document.description,
      isCompilation: document.isCompilation,
      customCss,
      customHtml,
      editions: document.editions
        .filter((e) => !e.isDraft)
        .map((edition) => {
          const editionMeta = meta.get(`${path}/${edition.type}`);
          if (!editionMeta) red(`No edition meta found for ${edition.path}`);
          return {
            id: `${friend.lang}/${friend.slug}/${document.slug}/${edition.type}`,
            type: edition.type,
            isbn: edition.isbn,
            ...(editionMeta
              ? {
                  size: editionMeta.paperback.size,
                  pages: editionMeta.paperback.volumes[0],
                }
              : { pages: 222, size: `m` }),
          };
        }),
    };
  });
}

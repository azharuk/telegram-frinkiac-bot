import TelegramClient from './services/telegramClient';
import FrinkiacApi from './services/frinkiacApi';

const frinkiacApi = new FrinkiacApi();
const SCREENSHOT_HEIGHT = 480;
const SCREENSHOT_WIDTH = 640;
const EM_WIDTH = 15; // Amount of M letters that fit in a single line.

// From http://stackoverflow.com/a/105074, just something to test for the time being.
function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

/**
 * Splits the caption in case it's needed and the user didn't split it manually.
 * @param  {string} caption The caption as provided by the user.
 * @return {string}         The caption splitted into several lines.
 */
function processCaption(caption) {
  if (caption.includes('\n')) {
    // The user separated the caption into several lines on purpose, let's respect that.
    return caption;
  }

  let words = caption.split(' ').filter(s => s);
  let lines = [[]];
  let currentLine = 0;

  words.forEach(word => {
    let currentLineLength = lines[currentLine].reduce((acc, w) => acc + w.length, 0);

    if (currentLineLength + word.length > EM_WIDTH) { // Ignoring spaces on purpose - they shouldn't matter unless in a line full of M's
      currentLine++;
      lines[currentLine] = [word];
    } else {
      lines[currentLine].push(word);
    }
  });

  return lines.map(line => line.join(' ')).join('\n');
}

/**
 * @class Bot to respond to messages from Telegram users.
 */
export default class {
  constructor({ client = new TelegramClient(process.env.BOT_TOKEN) } = {}) {
    this.client = client;
  }

  respondTo(update) {
    if (update.message) {
      this.respondToMessage(update.message);
    } else if (update.inline_query) {
      this.respondToInlineQuery(update.inline_query);
    }
  }

   respondToMessage(message) {
     if (!message.text) {
       return;
     }

     if (message.text.startsWith('/start')) {
       const startMessage = 'Use this bot inline to search a Simpson screenshot on frinkiac.com.\n' +
                            'For example: @FrinkiacSearchBot d\'oh';

       this.client.sendText(startMessage, message.chat.id);
     }

     if (message.text.startsWith('/help')) {
       const helpMessage = 'This is an inline bot. This means that you can use it on any chat, private or group, without ' +
                           'inviting it. Just type "@FrinkiacSearchBot <your search>" and wait. The bot will show you some ' +
                           'screenshots matching your query, and you can select one of them. Try it here! Just make sure to ' +
                           'add "@FrinkiacSearchBot" at the beginning of your message.\n\n' +
                           'You can generate "meme" images by adding your own subtitle to the image. To do this, write your ' +
                           'search query, and the text you want separated by a slash (/). For instance, "@FrinkiacSearchBot ' +
                           'drugs lisa / give me the drugs, lisa" and then pick one of the thumbnails. The image will be ' +
                           'generated with your text.';

       this.client.sendText(helpMessage, message.chat.id);
     }
   }

   respondToInlineQuery(inlineQuery) {
     if (!inlineQuery.query) {
       return;
     }

     let queryParts = inlineQuery.query.split('/').map(s => s.trim());
     let query = queryParts[0];
     let caption = queryParts[1];

     frinkiacApi.search(query).then(results => {
       return results.map(result => {
         let photoUrl = caption ? frinkiacApi.memeUrlFor(result, processCaption(caption)) : frinkiacApi.urlFor(result);

         return {
           type: 'photo',
           id: guid(),
           photo_url: photoUrl,
           thumb_url: frinkiacApi.thumbnailUrlFor(result),
           photo_width: SCREENSHOT_WIDTH,
           photo_height: SCREENSHOT_HEIGHT
         };
       });
     }).then(queryResults => {
       return this.client.answerInlineQuery(inlineQuery.id, queryResults);
     });
   }
}

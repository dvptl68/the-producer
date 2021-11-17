const { Client, Intents } = require('discord.js');
const ytdl = require('ytdl-core');
const { prefix, token } = require('./config.json');

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
client.login(token);

client.once('ready', () => {
  console.log('Ready!');
});

client.on('messageCreate', async message => {

  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  if (!content.startsWith(prefix)) return;

  if (content.startsWith(`${prefix}play`)) message.channel.send('Playing music.');
  else if (content.startsWith(`${prefix}stop`)) message.channel.send('Stopping music.');
  else message.channel.send('Not a valid command.');
});

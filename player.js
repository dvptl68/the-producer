const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  NoSubscriberBehavior
} = require('@discordjs/voice');
const playdl = require('play-dl');

const log = out => console.log(`[${new Date().toLocaleString()}] ${out}`);

class Player {

  constructor() {

    // Audio player and song queue
    this.player = createAudioPlayer({
	    behaviors: {
		    noSubscriber: NoSubscriberBehavior.Stop,
	    },
    });
    this.queue = [];

    // Plays next song if queue is not empty
    this.player.on(AudioPlayerStatus.Idle, () => {

      if (this.queue.length === 0 || this.player.state.status !== AudioPlayerStatus.Idle) return;

      const { title, resource, channel } = this.queue.shift();

      // Attempt to play song, re-emitting event upon failure
      try {
        this.player.play(resource);
      } catch (err) {
        log(`Failed to play "${title}"`);
        log(err);
        channel.send(`Failed to play ***${title}***!`);
        this.player.emit(AudioPlayerStatus.Idle);
      }

      log(`Playing "${title}"`);
      channel.send(`Playing ***${title}***`);
    });
  }

  async playSong(textChannel, voiceChannel, song) {

    // Join voice channel
    const conn = joinVoiceChannel({
		  channelId: voiceChannel.id,
		  guildId: voiceChannel.guild.id,
		  adapterCreator: voiceChannel.guild.voiceAdapterCreator
	  });

    // Wait 30 seconds for connection to be ready
	  try {
		  await entersState(conn, VoiceConnectionStatus.Ready, 30e3);
      log("Created voice connection");
	  } catch (error) {
		  conn.destroy();
      log("Failed to establish voice connection");
		  log(err);
      return "Failed to join voice channel!";
	  }

    // Search song
    const songInfo = await playdl.search(song, { limit: 1 });
    if (songInfo.length === 0) {
      log(`ERROR: "${song}" not found`);
      return `***${song}*** not found!`;
    }

    // Get song playable resource
    const title = songInfo[0].title;
    const url = songInfo[0].url;
    let resource;
    try {
      const stream = await playdl.stream(url);
      resource = createAudioResource(stream.stream, { inputType: stream.type });
    } catch (err) {
      log(`Failed to queue "${title}"`);
      log(err);
      return `Failed to queue ***${title}***!`;
    }
  
    this.queue.push({
      title: title,
      resource: resource,
      channel: textChannel
    });

    // Emit player event and subscribe connection to player
    this.player.emit(AudioPlayerStatus.Idle);
    conn.subscribe(this.player);

    log(`Queued "${title}" (${url})`);
    return `Queued ***${title}***\n${url}`;
  }

  isPaused() {
    return this.player.state.status === AudioPlayerStatus.Paused;
  }

  isPlaying() {
    return this.player.state.status === AudioPlayerStatus.Playing;
  }

  pause() {
    this.player.pause();
  }

  unpause() {
    this.player.unpause();
  }

  skip() {
    this.player.stop();
    this.player.emit(AudioPlayerStatus.Idle);
  }

  printQueue() {

    let output = "Songs in queue:";
    if (queue.length === 0) {
      output = "No songs are in the queue.";
    } else {
      for (let i = 0; i < queue.length; i++) {
        output += `\n**${i + 1}**: *${queue[i].title}*`;
      }
    }

    return output;
  }

  remove(ind) {
    const { title } = queue[ind - 1];
    this.queue.splice(ind - 1, 1);
    return title;
  }

  stop() {
    this.queue = [];
    this.player.stop();
  }

  leave(guildId) {

    const conn = getVoiceConnection(guildId);

    if (conn === undefined) {
      log("ERROR: No voice connection exists");
      return "I am not in a voice channel!";
    } else {
      conn.destroy();
      log("Destroyed voice connection");
    }

    this.stop();
  }

}

module.exports = { Player };

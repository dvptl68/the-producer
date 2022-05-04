const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  NoSubscriberBehavior
} = require("@discordjs/voice");
const playdl = require("play-dl");

class Player {

  constructor(guildId, logger) {

    // Guild player information
    this.guildId = guildId;
    this.voiceChannel = null;
    this.log = logger;

    // Audio player and song queue
    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Stop,
      },
    });
    this.queue = [];

    this.log.info(`Created player`);
  }

  // Add listener function for when player becomes idle
  #addPlayerIdleListener() {

    this.player.on(AudioPlayerStatus.Idle, () => {

      // Ensure queue is not empty and status is correct
      if (this.queue.length === 0) return this.stop();
      if (this.player.state.status !== AudioPlayerStatus.Idle && this.player.state.status !== AudioPlayerStatus.Paused) return;

      const { title, resource, channel } = this.queue.shift();

      // Attempt to play song, re-emitting event upon failure
      try {
        this.player.play(resource);
      } catch (err) {
        this.log.error(`Failed to play "${title}"`);
        this.log.error(err);
        channel.send(`Failed to play ***${title}***!`);
        this.player.emit(AudioPlayerStatus.Idle);
      }

      this.log.info(`Playing "${title}"`);
      channel.send(`Playing ***${title}***`);
    });
  }

  // Join voice channel and play given song
  async playSong(channel, voiceChannel, song) {

    this.voiceChannel = voiceChannel;

    // Join voice channel
    const conn = joinVoiceChannel({
      channelId: this.voiceChannel.id,
      guildId: this.guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator
    });

    // Wait 30 seconds for connection to be ready
    try {
      await entersState(conn, VoiceConnectionStatus.Ready, 30e3);
      this.log.info("Created voice connection");
    } catch (error) {
      this.voiceChannel = null;
      conn.destroy();
      this.log.error("Failed to establish voice connection");
      this.log.error(err);
      channel.send("Failed to join voice channel!");
      return;
    }

    // Search song
    const songInfo = await playdl.search(song, { limit: 1 });
    if (songInfo.length === 0) {
      this.log.error(`"${song}" not found`);
      channel.send(`***${song}*** not found!`);
      return;
    }

    // Get song playable resource
    const title = songInfo[0].title;
    const url = songInfo[0].url;
    let resource;
    try {
      const stream = await playdl.stream(url);
      resource = createAudioResource(stream.stream, { inputType: stream.type });
    } catch (err) {
      this.log.error(`Failed to queue "${title}"`);
      this.log.error(err);
      channel.send(`Failed to queue ***${title}***!`);
      return;
    }

    this.queue.push({
      title: title,
      resource: resource,
      channel: channel
    });

    this.log.info(`Queued "${title}" (${url})`);
    channel.send(`Queued ***${title}***\n${url}`);

    // Replace player listener, emit event, and subscribe connection to player
    this.player.removeAllListeners();
    this.#addPlayerIdleListener();
    this.player.emit(AudioPlayerStatus.Idle);
    conn.subscribe(this.player);
  }

  // Pause current music if any
  pause(channel) {

    // Check that something is playing
    if (this.player.state.status !== AudioPlayerStatus.Playing) {
      this.log.warn("Nothing currently playing");
      channel.send("Nothing is currently playing!");
      return false;
    }

    // Attempt to pause music
    if (this.player.pause()) {
      this.log.info("Paused music");
      return true
    } else {
      this.log.error("Failed to pause music");
      channel.send("Failed to pause music!");
      return false;
    }
  }

  // Unpause current music
  unpause(channel) {

    // Check that something is paused
    if (this.player.state.status !== AudioPlayerStatus.Paused) {
      this.log.warn("Nothing currently paused");
      channel.send("Nothing is currently paused!");
      return false;
    }

    // Attempt to unpause music
    if (this.player.unpause()) {
      this.log.info("Unpaused music");
      return true
    } else {
      this.log.error("Failed to unpause music");
      channel.send("Failed to unpause music!");
      return false;
    }
  }

  // Skip current music
  skip(channel) {

    // Check that something is playing
    if (this.player.state.status === AudioPlayerStatus.Idle) {
      this.log.warn("Nothing currently playing");
      channel.send("Nothing is playing!");
      return { "skip": false, "leave": false };
    }

    // Stop playing and emit idle event
    if (this.player.stop()) {
      this.log.info("Skipped current song");
      let leave = false;
      if (this.queue.length === 0) leave = this.stop(channel);
      return { "skip": true, "leave": leave };
    } else {
      this.log.error("Failed to skip song");
      channel.send("Failed to skip song!");
      return { "skip": false, "leave": false };;
    }
  }

  // List song queue
  printQueue(channel) {

    // Produce queue output string
    let output = "Songs in queue:";
    if (this.queue.length === 0) {
      output = "No songs are in the queue!";
    } else {
      for (let i = 0; i < this.queue.length; i++) {
        output += `\n**${i + 1}**: *${this.queue[i].title}*`;
      }
    }

    channel.send(output);
    this.log.info("Printed song queue");
  }

  // Remove specified music from queue
  remove(channel, ind) {

    // Check that the given index is an integer and in the queue
    ind = parseInt(ind);
    if (isNaN(ind)) {
      this.log.warn("Provided parameter is not a number");
      channel.send(`"${param}" is not a number!`);
      return;
    }
    if (ind < 1 || ind > this.queue.length) {
      this.log.warn("Provided parameter is not in queue range");
      channel.send(`Song #${ind} is not in the queue!`);
      return;
    }

    const { title } = this.queue[ind - 1];
    this.queue.splice(ind - 1, 1);

    this.log.info(`Removed queue item ${ind}: "${title}"`);
    channel.send(`Removed ***${title}*** from queue.`);
  }

  // Stop player and clear queue
  stop(channel = null) {

    // Check that bot is in a voice channel and that a voice connection exists
    let conn = getVoiceConnection(this.guildId);
    if (conn === undefined) {
      this.log.warn("No voice connection exists");
      if (channel !== null) channel.send("Nothing is playing!");
      return false;
    }

    // Clear queue and destroy voice connection
    this.voiceChannel = null;
    this.queue = [];
    this.player.removeAllListeners();
    conn.destroy();
    this.log.info("Stopped music, cleared queue, and destroyed voice connection");
    return true;
  }
}

module.exports = { Player };

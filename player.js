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

  constructor(guildId) {

    // Information needed for proper player functionality
    this.guildId = guildId;
    this.voiceChannel = null;

    // Audio player and song queue
    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Stop,
      },
    });
    this.queue = [];
  }

  // Add listener function for when player becomes idle
  #addPlayerIdleListener() {

    this.player.on(AudioPlayerStatus.Idle, () => {

      // Ensure queue is not empty and status is correct
      if (this.queue.length === 0) return this.stop(null);
      if (this.player.state.status !== AudioPlayerStatus.Idle) return;

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
      log("Created voice connection");
    } catch (error) {
      this.voiceChannel = null;
      conn.destroy();
      log("Failed to establish voice connection");
      log(err);
      channel.send("Failed to join voice channel!");
      return;
    }

    // Search song
    const songInfo = await playdl.search(song, { limit: 1 });
    if (songInfo.length === 0) {
      log(`ERROR: "${song}" not found`);
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
      log(`Failed to queue "${title}"`);
      log(err);
      channel.send(`Failed to queue ***${title}***!`);
    }
  
    this.queue.push({
      title: title,
      resource: resource,
      channel: channel
    });

    log(`Queued "${title}" (${url})`);
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
      log("ERROR: Nothing currently playing");
      channel.send("Nothing is currently playing!");
      return false;
    }

    // Attempt to pause music
    if (this.player.pause()) {
      log("Paused music");
      return true
    } else {
      log("ERROR: Failed to pause music");
      channel.send("Failed to pause music!");
      return false;
    }
  }

  // Unpause current music
  unpause(channel) {

    // Check that something is paused
    if (this.player.state.status !== AudioPlayerStatus.Paused) {
      log("ERROR: Nothing currently paused");
      channel.send("Nothing is currently paused!");
      return false;
    }

    // Attempt to unpause music
    if (this.player.unpause()) {
      log("Unpaused music");
      return true
    } else {
      log("ERROR: Failed to unpause music");
      channel.send("Failed to unpause music!");
      return false;
    }
  }

  // Skip current music
  skip() {

    // Check that something is playing
    if (this.player.state.status !== AudioPlayerStatus.Playing) {
      log("ERROR: Nothing currently playing");
      channel.send("Nothing is currently playing!");
      return { "skip": false, "leave": false };
    }

    // Stop playing and emit idle event
    if (this.player.stop()) {
      log("Skipped current song");
      return { "skip": true, "leave": this.queue.length === 0 };
    } else {
      log("ERROR: Failed to skip song");
      channel.send("Failed to skip song!");
      return { "skip": false, "leave": false };;
    }
  }

  // List song queue
  printQueue(channel) {

    // Produce queue output string
    let output = "Songs in queue:";
    if (this.queue.length === 0) {
      output = "No songs are in the queue.";
    } else {
      for (let i = 0; i < this.queue.length; i++) {
        output += `\n**${i + 1}**: *${this.queue[i].title}*`;
      }
    }

    channel.send(output);
    log("Printed song queue");
  }

  // Remove specified music from queue
  remove(channel, ind) {

    const { title } = this.queue[ind - 1];
    this.queue.splice(ind - 1, 1);

    log(`Removed queue item ${ind}: "${title}"`);
    channel.send(`Removed ***${title}*** from queue.`);
  }

  // Stop player and clear queue
  stop(channel) {

    // Check that bot is in a voice channel and that a voice connection exists
    let conn = getVoiceConnection(this.guildId);
    if (conn === undefined) {
      log("ERROR: No voice connection exists");
      if (channel !== null) channel.send("I am not in a voice channel!");
      return false;
    }

    // Clear queue and destroy voice connection
    this.voiceChannel = null;
    this.queue = [];
    this.player.removeAllListeners();
    conn.destroy();
    log("Cleared queue and destroyed voice connection");
    return true;
  }
}

module.exports = { Player };

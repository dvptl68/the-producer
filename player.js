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

    /*
    // Plays next song if queue is not empty
    player.on(AudioPlayerStatus.Idle, () => {

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
      this.channel.send(`Playing ***${title}***`);
    });
    */
  }

  play(channel) {

    // Join voice channel
    const conn = joinVoiceChannel({
		  channelId: channel.id,
		  guildId: channel.guild.id,
		  adapterCreator: channel.guild.voiceAdapterCreator
	  });

    // Wait 30 seconds for connection to be ready
	  try {
		  await entersState(conn, VoiceConnectionStatus.Ready, 30e3);
      log("Created voice connection");
	  } catch (error) {
		  conn.destroy();
      log("Failed to establish voice connection");
		  log(err);
      message.channel.send("Failed to join voice channel!");
      return;
	  }
  }

  isPaused() {
    return this.player.state.status === AudioPlayerStatus.Paused;
  }

  pause() {
    if (!this.player.pause()) {
      log("failed to pause");
    }
  }

  unpause() {
    if (!this.player.unpause()) {
      log("failed to unpause");
    }
  }
}

module.exports = { Player };

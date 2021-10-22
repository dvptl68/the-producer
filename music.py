import pafy
import vlc as v
from time import sleep

# url = input('Enter a YouTube URL to play song: ')
url = 'https://www.youtube.com/watch?v=e16ZqNHSaEY'

# Get best playable URL
video = pafy.new(url)
bestURL = video.getbest()
playURL = bestURL.url

# Play song using VLC media player
vlc = v.Instance('--no-video')
player = vlc.media_player_new()
media = vlc.media_new(playURL)
media.get_mrl()
player.set_media(media)
player.play()

# Wait for song to finish before 
goodStates = ["State.Playing", "State.NothingSpecial", "State.Opening"]
while str(player.get_state()) in goodStates:
  sleep(1)

player.stop()

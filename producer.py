import os
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()
TOKEN = os.getenv('DISCORD_TOKEN')    

bot = commands.Bot(command_prefix='!')

@bot.command(name = 'join', help = 'Join the voice channel you are currently in.')
async def join(ctx):
  voice_client = ctx.message.author.voice
  if voice_client is not None:
    await voice_client.channel.connect()
  else:
    await ctx.send("You are not connected to a voice channel.")

@bot.command(name = 'leave', help = 'Leave the voice channel.')
async def leave(ctx):
  voice_client = ctx.voice_client
  if voice_client is not None:
    await voice_client.disconnect()
  else:
    await ctx.send("I am not connected to a voice channel.")

bot.run(TOKEN)

import os
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()
TOKEN = os.getenv('DISCORD_TOKEN')

bot = commands.Bot(command_prefix='!')

@bot.command(name='hi', help='')
async def nine_nine(ctx):
  await ctx.send('hello')

bot.run(TOKEN)

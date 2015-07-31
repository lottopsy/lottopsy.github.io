import re
import json
from datetime import datetime

"""Run process.py to generate mm.js and pb.js from mm.data and pb.data"""

def process_pb(file, oldest_date):
    """
    Process the specified file into the given data object.
    Use this for files where the first line should be skipped,
    the game has five numbers and one bonus, and each line
    contains [date, numbers, bonus] separated by whitespace
    in that order.

    :param file: File iterator for the specified file.
    :param oldest_date: Most ancient date to use. This should be a datetime object.
    :return: A list where each entry is a dictionary with the keys "date" and
    "numbers," with "date" keying a date string of format yyyy-mm-dd and
    "numbers" keying a list of numbers and bonus numbers, if any.
    """
    data = []
    next(file)  # skip first line
    for line in file:
        raw_data = re.split('\s+', line)
        date_object = datetime.strptime(raw_data[0], "%m/%d/%Y")
        if date_object >= oldest_date:
            draw_data = {
                'date': date_object.strftime('%Y-%m-%d'),
                'numbers': sorted([int(x) for x in raw_data[1:6]]) + [int(raw_data[6])]
                }
            data.insert(0, draw_data)
    return data
    
def process_mm(file, oldest_date):
    """
    Process the specified file into the given data object.
    Use this for csv files where in the Texas Lottery style.
    See http://txlottery.org/export/sites/lottery/Games/Mega_Millions/Winning_Numbers/megamillions.csv

    :param file: File iterator for the specified file.
    :param oldest_date: Most ancient date to use. This should be a datetime object.
    :return: A list where each entry is a dictionary with the keys "date" and
    "numbers," with "date" keying a date string of format yyyy-mm-dd and
    "numbers" keying a list of numbers and bonus numbers, if any.
    """
    data = []
    for line in file:
        raw_data = re.split(',', line)
        date_object = datetime(int(raw_data[3]), int(raw_data[1]), int(raw_data[2]))
        if date_object >= oldest_date:
            draw_data = {
                'date': date_object.strftime('%Y-%m-%d'),
                'numbers': sorted([int(x) for x in raw_data[4:9]]) + [int(raw_data[9])]
            }
            data.append(draw_data)
    return data

games = [
    {
        'raw_file': 'data/pb.data',
        'output_file': 'data/pb.js',
        'oldest_date': datetime(2012, 1, 15),  # start of 59/35 format
        'game_processor': process_pb
    },
    {
        'raw_file': 'data/mm.data',
        'output_file': 'data/mm.js',
        'oldest_date': datetime(2013, 10, 19),  # start of 75/15 format
        'game_processor': process_mm
    }
]

for game in games:
    # Extract data from new file; save it to database
    with open(game['raw_file'], 'r') as raw_file, open(game['output_file'], 'w') as output_file:
        data = game['game_processor'](raw_file, game['oldest_date'])
        output_file.write('module.exports = ' + json.dumps(data) + ';')



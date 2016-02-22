import base64

'''
list of names is parsed, each name.xml file is read, encoded to base64, and
written out to name.b64.

To use:
  * edit list of filenames for existing xml form fixtures.
  * run `python encodeb64.py`
'''

for filename in ['form1definition', 'form2definition']:
  with open(filename + '.xml', 'r') as readfile:
    with open(filename + '.b64', 'w') as writefile:
      writefile.write(base64.b64encode(readfile.read()))

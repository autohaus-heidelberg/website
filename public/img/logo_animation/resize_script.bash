
for i in $(seq 1 10);
do                                       
magick $i.jpg -resize 30% $i.jpg
done  
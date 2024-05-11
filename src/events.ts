export type Event = {
    date: string, 
    time: string,
    title: string, 
    descriptionShort: string, 
    descriptionLong?: string, 
    artists: Array<{
        name: string,
        image?: string, 
        link?: string, 
        description?: string, 
        soundcloud?: string, 
        youtube?: string,
    }>
};

export const events: Event[] = [
    {
        date: '2024-05-16',
        title: 'Busted Head Racket ❤️ Socke',
        time: '20 Uhr',
        descriptionShort: 'Am 16 Mai ist mal wieder richtig Zeit für Punk.\n Es geht los mit der instantan lengendären Heidelberger Punk Band Socke, danach spielt Busted Head Racket auws Newcastle ihren genialen synth-punk.',
        artists: [
            {
                name: 'Busted Head Racket',
                link: "https://bustedheadracket.bandcamp.com/",
                description: "Originally starting out as a solo bedroom project for bassist-vocalist Arden Guff, Busted Head Racket, have been one of leading bands in the current Newcastle punk scene. Their radiant energy of unrestrained and hyper-accelerated synth-punk recently earned them an opening spot for rising Nashville punks Snõõper. Following up last year's split tape with weirdo German punk Teo Wise, the trio that now includes Guff, keyboardist Dave Cunningham, and drummer Riley Gardiner, have a new 8-track EP out today called Junk Food.",
                youtube: "https://www.youtube.com/embed/Eu6Qv_ySFgo?si=yZZBqU3RFmYtaGAy",
                soundcloud: "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/1376989297&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true"
            },
            {
                name: 'Socke',
                description: "Legendäre Heidelberger Punk Band, muss man nicht viel zu sagen.",
            },
        ]
    },


    {
        date: '2024-05-17',
        title: 'The Whiffs ❤️ City Boys',
        time: '20 Uhr',
        descriptionShort: 'Am 17 Mai beehrt uns the Wiffs aus Kansas. Davor spielen die City Boys',
        artists: [
            {
                name: 'The Whiffs',
                description: "This album just feels like America. It transports me to some mythical dive bar where The Replacements, Tom Petty, and Cheap Trick still rule the jukebox. — Faster And Louder",
                youtube: "https://www.youtube.com/embed/6dM2rAb-RL8?si=ecPIR3xLm2FzGqNn",
                link: "https://www.thewhiffsband.com/"
            },
            {
                name: 'City Boys',
                link: 'https://city-boys.bandcamp.com/',
                description: "Auf Gleis 7 schaufeln die City Boys ordentlich Kohlen in den Kessel des Country-Schrammelpop-Zugs auf dem Weg von Heidelberg nach Shelbyville. Toot-toot, bei 90/mph wollen alle sofort einen Line Dance aufs Parkett vom Bordbistro legen. Gitarre, Schlagzeug und Bass schlingern roadrunnermäßig um die 3/4 Akkord-Kurve. Jetzt erstmal einen Stopp bei Tank & Rast.",
                youtube: 'https://www.youtube.com/embed/hpMjJ-4r-iM?si=8o89HfQU_fF9A_zP'
            },
        ]
    },



    {
        date: '2024-05-28',
        title: 'Forest Ray ❤️ The Roaring 420s',
        time: '20 Uhr',
        descriptionShort: 'Am 28 Mai wird es sommerlich psychedelisch im Autohaus, Forest Ray und The Roaring 420s.',
        artists: [
            {
                name: 'Forest Ray',
                description: "Forest Ray is a psychedelic rock project whose dedication to analog recording has harbored a darker, older and more intimate sound. Forest Ray's music combines guitar driven psychedelic rock with tinges of raw synth-laced post-punk, Tropicalia flute and uninhibited performances that embody the garage punk aesthetic that fueled the group’s creation ",
                youtube: "https://www.youtube.com/embed/I6estL4fqvI?si=hFss2Vy5v6V2rWpF",
                link: "https://forestray.bandcamp.com/"
            },
            {
                name: 'The Roaring 420s',
                link: "https://theroaring420s.bandcamp.com/album/the-roaring-420s",
                description: "Blending surf rock and late 60s pre-Punk into Eastern psychedelia The Roaring 420s from Dresden, Germany, rather sound like an obscure little gem discovered at a garage sale in California. Roughly located somewhere between The Beach Boys and The Velvet Underground, they’re bursting out with twangy guitars, groovin' organ and an electric sitar! ",
                youtube: 'https://www.youtube.com/embed/-psBFcQ8t-k?si=TWWI2BCI9UMncFcC'
            },
        ]
    }



]
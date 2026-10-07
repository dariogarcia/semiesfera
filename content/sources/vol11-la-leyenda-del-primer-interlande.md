---
title: |
	La leyenda del primer interlande\
	-\
	Historias con historia vol 11
header-includes:
  - \usepackage{microtype}
  - \usepackage{fontspec}
  - \usepackage{wrapfig}
  - \usepackage{graphicx}
  - \usepackage{fontawesome5}
  - \usepackage{lettrine}
  - \usepackage{changepage}
  - \renewcommand{\LettrineFontHook}{\normalfont}
  - \usepackage{tikz}
  - \usetikzlibrary{decorations.pathmorphing} 
  - \usetikzlibrary{patterns}
  - \usetikzlibrary{decorations.markings}
  - \usepackage[most]{tcolorbox}
  - \usepackage{caption}
  - \usepackage{amssymb}
  - \usepackage{enumitem}
  - \usepackage{eso-pic}
  - |
    \newcommand{\noHyph}{\hyphenpenalty10000\exhyphenpenalty10000\sloppy}
  - |
    \newcommand{\timelinefooter}[2][4in]{%
      \AddToShipoutPictureFG*{%
        \put(0,\LenToUnit{0.45in}){%
          \makebox[\paperwidth][c]{\includegraphics[width=#1]{#2}}%
        }%
      }%
    }
  - \newfontfamily\typewriterfont{Cousine}
  - \newfontfamily\royalfont{GFS Didot}
  - \newfontfamily\madfont{Gentium Book Plus}
  - \newfontfamily\posterfont{PT Mono}
  - \newfontfamily\techfontfam{Go Mono}
  - \newfontfamily\handwritingfont{TeX Gyre Chorus}
  - \newfontfamily\stencilfont[BoldFont={URW Gothic Demi}]{URW Gothic}
  - |
    \DeclareCaptionFormat{figcaption}{\rule{\linewidth}{0.4pt}\par\vspace{4pt}#1#2#3}
    \captionsetup{
      format=figcaption,
      font={small,it,color=gray!40!black},
      labelfont={bf,it},
      labelsep=colon,
      justification=centering,
      skip=6pt,
      width=0.92\linewidth
    }
  - |
    \tcbset{
      commonbox/.style={
        enhanced,
        breakable,
        boxrule=0.8pt,
        left=12pt, right=12pt, top=12pt, bottom=12pt,
        arc=0mm,
        boxsep=0pt,
        fontupper=\small
      },
      audioguidebox/.style={ enhanced, breakable,  boxrule=0.5pt, colback=gray!3!white, colframe=gray!55!black, arc=0mm, left=16pt, right=16pt, top=16pt, bottom=16pt, fontupper=\normalfont\scshape\small, borderline north={1.2pt}{2pt}{gray!55!black}, borderline south={1.2pt}{2pt}{gray!55!black}, overlay={ \draw[gray!55!black, thick] ([xshift=8pt,yshift=-8pt]frame.north west) -- ++(10pt,0); \draw[gray!55!black, thick] ([xshift=8pt,yshift=-8pt]frame.north west) -- ++(0,-10pt); \draw[gray!55!black, thick] ([xshift=-8pt,yshift=-8pt]frame.north east) -- ++(-10pt,0); \draw[gray!55!black, thick] ([xshift=-8pt,yshift=-8pt]frame.north east) -- ++(0,-10pt); \draw[gray!55!black, thick] ([xshift=8pt,yshift=8pt]frame.south west) -- ++(10pt,0); \draw[gray!55!black, thick] ([xshift=8pt,yshift=8pt]frame.south west) -- ++(0,10pt); \draw[gray!55!black, thick] ([xshift=-8pt,yshift=8pt]frame.south east) -- ++(-10pt,0); \draw[gray!55!black, thick] ([xshift=-8pt,yshift=8pt]frame.south east) -- ++(0,10pt); \node[anchor=north east, font=\small, gray!60!black] at ([xshift=-6pt,yshift=-6pt]frame.north east) {\faVolumeUp}; } },
      examenbox/.style={ enhanced, breakable, boxrule=1pt, colback=white, colframe=black, arc=0mm, left=12pt, right=12pt, top=12pt, bottom=12pt, fontupper=\typewriterfont\small, borderline north={1pt}{0pt}{black}, borderline south={1pt}{0pt}{black}, overlay={ \node[anchor=north east, rotate=-15, draw=red!70!black, thick, circle, font=\bfseries\scriptsize, red!70!black, minimum size=0.8cm, align=center, inner sep=1pt] at ([xshift=-8pt,yshift=-16pt]frame.north east) {CUERPO DE\\CIUDADANIA}; } },
      manifiestobox/.style={ enhanced, unbreakable, boxrule=2.5pt, colback=pink!16!white, colframe=black, arc=0mm, left=16pt, right=16pt, top=22pt, bottom=14pt, fonttitle=\posterfont\bfseries\Large, fontupper=\posterfont\upshape\addfontfeature{LetterSpace=2}\noHyph, overlay={ \fill[black] ([yshift=0pt]frame.north west) rectangle ([yshift=-8pt]frame.north east); } },
      edictobox/.style={ enhanced, breakable,  boxrule=1.5pt, colback=yellow!4!white, colframe=yellow!45!black, arc=0mm, left=18pt, right=18pt, top=16pt, bottom=20pt, fonttitle=\royalfont\bfseries, fontupper=\royalfont\upshape, borderline={0.5pt}{2pt}{yellow!45!black}, overlay={ \draw[yellow!45!black, thin] ([xshift=4pt,yshift=-4pt]frame.north west) rectangle ([xshift=-4pt,yshift=4pt]frame.south east); \node[circle, draw=yellow!45!black, thick, fill=yellow!15!white, minimum size=0.9cm] at ([yshift=8pt]frame.south) {\TaakuT}; } },
		bandobox/.style={
		  enhanced, breakable,
		  boxrule=1pt,
		  colback=gray!5!white, colframe=gray!45!black,
		  arc=0mm,
		  left=18pt, right=18pt, top=16pt, bottom=20pt,
		  fonttitle=\royalfont\bfseries,
		  fontupper=\royalfont\upshape,
		  borderline={0.4pt}{2pt}{gray!45!black},
		  overlay={
		    \foreach \c in {north west, north east, south west, south east}{
		      \fill[gray!45!black] (frame.\c) circle (2.2pt);
		    }
		    \node[circle, draw=gray!45!black, thick, fill=gray!12!white, minimum size=0.9cm] at ([yshift=8pt]frame.south) {\TaakuT};
		  }
		},
      kaltsbox/.style={ enhanced, breakable, boxrule=0pt, colback=gray!2!white, arc=0mm, left=14pt, right=14pt, top=12pt, bottom=12pt, fontupper=\madfont\itshape\noHyph, overlay={ \draw[black!70, decorate, decoration={random steps, segment length=4pt, amplitude=1pt}] (frame.north west) -- (frame.north east) -- (frame.south east) -- (frame.south west) -- cycle; } },
     actabox/.style={ enhanced, breakable, boxrule=1pt, colback=blue!3!white, colframe=blue!55!black, arc=0mm, left=14pt, right=14pt, top=12pt, bottom=12pt, fontupper=\techfontfam\small, borderline west={4pt}{0pt}{blue!55!black},
     overlay first={
     \foreach \x in {0,-8,...,-40}{
      \draw[blue!20!white, thin] ([xshift=\x pt,yshift=0pt]frame.north east) -- ([xshift=\x pt,yshift=-40pt]frame.north east);
     }
     \foreach \y in {0,-8,...,-40}{
      \draw[blue!20!white, thin] ([xshift=-40pt,yshift=\y pt]frame.north east) -- ([xshift=0pt,yshift=\y pt]frame.north east);
     }
     },
     overlay last={
     \foreach \x in {0,-8,...,-40}{
      \draw[blue!20!white, thin] ([xshift=\x pt,yshift=0pt]frame.south east) -- ([xshift=\x pt,yshift=40pt]frame.south east);
     }
     \foreach \y in {0,8,...,40}{
      \draw[blue!20!white, thin] ([xshift=-40pt,yshift=\y pt]frame.south east) -- ([xshift=0pt,yshift=\y pt]frame.south east);
     }
     } },
     cartareybox/.style={ enhanced, breakable, boxrule=0.8pt, colback=orange!3!white, colframe=orange!35!black, arc=0mm, left=16pt, right=16pt, top=14pt, bottom=20pt, fontupper=\royalfont\itshape, borderline={0.4pt}{1.5pt}{orange!35!black}, overlay={ \node[circle, draw=orange!35!black, thick, fill=orange!15!white, minimum size=0.8cm] at ([yshift=10pt]frame.south) {\faCertificate}; } },
      diariobox/.style={ enhanced, breakable, boxrule=0pt, colback=orange!3!yellow!5!white, arc=0mm, left=14pt, right=14pt, top=14pt, bottom=12pt, fontupper=\handwritingfont\normalsize\noHyph, overlay={ \draw[black!50, decorate, decoration={random steps, segment length=5pt, amplitude=1.5pt}] (frame.north west) -- (frame.north east); \draw[black!30, thin] (frame.west) -- (frame.north west) -- (frame.north east) -- (frame.east) -- (frame.south east) -- (frame.south west) -- cycle; } },
      enciclopediabox/.style={ enhanced, breakable, boxrule=0.8pt, colback=brown!3!white, colframe=brown!40!black, arc=0mm, left=14pt, right=14pt, top=12pt, bottom=12pt, fontupper=\sffamily\small\sloppy, fonttitle=\sffamily\bfseries\small, overlay={ } }, manualbox/.style={ enhanced, breakable, boxrule=1.2pt, colback=black!3!white, colframe=black, arc=0mm, left=14pt, right=14pt, top=18pt, bottom=12pt, fontupper=\stencilfont\bfseries\addfontfeature{LetterSpace=8}\small, overlay={ } } } 
  - \newlist{checklist}{itemize}{1} \setlist[checklist]{label=$\square$, leftmargin=1.5em} 
  - |
    \newcommand{\docmeta}[1]{
      {\normalfont\sffamily\raggedright \small \color{gray!80!black} #1 \par}
      \vspace{4pt}
      \hrule height 0.5pt \vspace{10pt}
    }
  - |
    \newcommand{\dline}[2]{%
      \par\noindent
      \hangindent=1.5em\hangafter=1
      \textbf{#1:}\hspace{0.4em}#2\par\vspace{4pt}
    }
  - |
    \newcommand{\TaakuT}{%
	  \begin{tikzpicture}[baseline=-0.6ex]
	    \node[font=\royalfont\bfseries\Large] (T) {T};
	    \draw[thick] ([xshift=-3pt,yshift=1pt]T.north west) -- ([xshift=3pt,yshift=1pt]T.north east);
	    \draw[thick] ([xshift=-2pt,yshift=-2pt]T.south west) to[out=-90,in=180] ++(2pt,-2pt);
	    \draw[thick] ([xshift=2pt,yshift=-2pt]T.south east) to[out=-90,in=0] ++(-2pt,-2pt);
	  \end{tikzpicture}%
	}
pandoc_args: ["--pdf-engine=xelatex"]
mainfont: "Linux Libertine O"
geometry: "left=0.7in,right=0.7in,top=1in,bottom=1.2in,footskip=0.9in"
fontsize: 12pt
---

¡Alegría! Por fin ha llegado el dia. Hoy sí. Hoy toca revisar la historia más famosa de la semiesfera. La del intrépido explorador de Taaku, primero en pisar dos landes. Nada más y nada menos que el primer interlande. Quizá os suene su nombre de alguno de los libros, películas, videojuegos, llaveros, velas aromáticas y demás objetos de uso doméstico que ha protagonizado. Me refiero, por supuesto, a la leyenda de Xunei Thun. ¿Y quién mejor para introducir a nuestro personaje (¡como si hiciera falta!) que a los presidentes de su club de fans? Exacto, veamos que nos cuentan  de Xunei los historiadores de Taaku de finales del Siglo 5.


\begin{figure}[h]
\centering
\includegraphics[width=.4\linewidth]{../../_Sources/imgs/xunei_sopa/xunei_sopa_logo.jpeg}
  \caption*{Imagen promocional de un fabricante de comida preparada.}
\end{figure}


::: {.doc-box}
\begin{tcolorbox}[audioguidebox, unbreakable, title={}]
\docmeta{
	\textbf{Fuente:} Museo Xunei Thun de Arte, Taaku\\ \textbf{Tipo:} Audioguía para visitantes\\
	\textbf{Año:} 480 GC\\
	\textbf{Contexto:} Ubicado en la ciudad de Deishe, el Museo Xunei Thun fue regido desde su creación en el Siglo 5 hasta principios del Siglo 7 por corrientes de ideología landista. Antes de los movimientos de restitución de la época moderna, el museo albergaba la práctica totalidad de los artefactos históricos relativos a Xunei. 
}
\dline{Bob}{Estimados visitantes, cuando estén listos, continúen hasta la sala 5. Pulsen el botón de reproducción para empezar la siguiente pista.}
\dline{Ann}{Recuerden que pueden detener, reanudar y repetir nuestras explicaciones en cualquier momento.}
AUDIO SALA 5
\dline{Bob}{Aquí se encuentra mi obra preferida de todo el museo.}
\dline{Ann}{Eso lo dices de casi todas, Bob.}
\dline{Bob}{¡Es que tengo muchas preferidas! Pero esta escultura, "El paso de la historia", es especial. Te juro que sueño con ella. Un Xunei gigante de bronce que pasa por encima de mi casa a grandes zancadas. ¿Acaso se te ocurre una manera más sugerente de representar al primer interlande?}
\dline{Ann}{La verdad es que no eres el único al que le encanta. Esta pieza es considerada una de las cinco grandes obras sobre Xunei Thun. Del maestro Papha Naara, fue esculpida en el año 56 GC, para conmemorar el 100 aniversario del nacimiento de Xunei, y estuvo instalada en el palacio real de Etaan durante 300 años.}
\dline{Bob}{Me encanta como representa lo imponente e imparable de la gran conexión. La victoria del ser humano sobre las inexpugnables sumontañas, y el sacrificio final del individuo que no mira atrás, abriendo camino para los demás. Si es que lo tiene todo.}
\dline{Ann}{Sin duda es de un gran simbolismo. La sumontaña Kalts'een, sobre la que camina Xunei, mide 14 kilómetros de altura, lo cual hace que a esta escala su estatura sea de unos 50 kilómetros de altura. Todo un coloso. Dicho esto, es importante reconocer que existe cierta controversia con esta obra, pues algunos ven en ella un enaltecimiento del imperialismo de Taaku y de su historial de ocupación de otros landes.}
\dline{Bob}{Siempre habrá alguien que se sienta ofendido. Como me decia mi madre, ¡No se puede gustar a todo el mundo!}
\dline{Ann}{Si hablamos de la persona que dio inicio a la Gran Conexión (GC) y a sus trescientos años de caos y conflicto entre landes, unos cuantos sentimientos heridos es lo mínimo que podemos esperar. Pero fíjate, sin embargo, en la sutileza del artista. El pie derecho de la escultura apenas roza Yukar, algo que se interpreta como una evidente muestra de respeto.}
\end{tcolorbox}
:::

\timelinefooter{../../_Sources/imgs/xunei_time/time1.png}

\clearpage

\begin{figure}[t]
\centering
\includegraphics[width=0.85\linewidth]{../../_Sources/imgs/xunei_paso/xunei_paso3.png}
  \caption*{\textit{"El paso de la historia"} - Papha Naara 56 GC}
\end{figure}

De pequeño me solía preguntar ¿Qué hay que hacer para que te recuerden como un titan de cincuenta kilómetros de altura? La respuesta de libro siempre era "tener una enorme capacidad de sacrificio, y una ambición capaz de doblegar al mismo destino". Lástima que solo pueda haber un primer interlande.

\newpage
::: {.doc-box}
\begin{tcolorbox}[examenbox, unbreakable, title={}]
\docmeta{
\textbf{Fuente:} Cuerpo de Ciudadania, Gobierno de Taaku\\
\textbf{Tipo: }Examen de Ciudadanía - Rúbrica de evaluación\\
\textbf{Año: }460 GC\\
\textbf{Contexto:} A mediados del Siglo 5, el auge del landismo en Taaku impulsó exámenes de acceso a la ciudadanía, necesario para obtener algunos derechos fundamentales.}
\textbf{Examen de Ciudadanía de Taaku}\\
\textit{Nota de corte:} 16/20 puntos. \\
\textit{Tiempo:} 50 minutos.\\
...\\
\textbf{Pregunta 6:} ¿Qué relación tuvieron Xunei Thun y el Quinto Rey de Taaku?\\
\begin{adjustwidth}{2cm}{0.5cm}
\textit{Respuesta tipo:} Xunei Thun fue cercano al Quinto Rey de Taaku, Kayaan Daak, durante su infancia. Hijo de una familia cercana a la monarquía, Xunei compartió formación con el futuro rey, y llegó a ser una de sus más cercanas amistades. Fue nombrado Administrador Real de Deishe a los veintisiete años, poco después de la coronación del Quinto Daak. Esa posición era de especial relevancia debido al rol central que jugaba la ciudad en el comercio y distribución de Denenita, uno de los materiales más importantes de la época. Los valores compartidos de lealtad y sacrificio por el lande mantuvieron estrechos los vínculos de ambos, que perduraron durante el resto de sus vidas.\\
\vspace{0.01em}\\
\textit{Rúbrica del examinador:} 
\begin{checklist}
	\item 0.3 puntos si menciona vínculo desde una edad temprana.
	\item 0.3 puntos si menciona el nombramiento como Administrador Real de Deishe.
	\item 0.4 puntos si menciona que la amistad entre ambos fue de por vida.
\end{checklist}
\vspace{2em}
\end{adjustwidth}
\textbf{Pregunta 7:} Marca los títulos otorgados de manera oficial a Xunei Thun:
\vspace{1em}
\begin{adjustwidth}{2cm}{0.5cm}
\begin{checklist}
	\item[$\times$] Faro de fidelidad
	\item[$\checkmark$] El primer interlande
	\item[$\times$] Soldado de lo desconocido
	\item[$\times$] El sacrificio de Taaku
	\item[$\checkmark$] Primer ciudadano del imperio
	\item[$\times$] Domador de sumontañas
	
\end{checklist}
\vspace{1em}
\textit{Rúbrica del examinador:}
\begin{itemize}
	\item Cada error resta medio punto.
	\item Nota mínima: 0 puntos.
\end{itemize}
\vspace{1em}
...
\end{adjustwidth}
\end{tcolorbox}
:::


\timelinefooter{../../_Sources/imgs/xunei_time/time2.png}


\clearpage

Existe un amplio consenso en que Xunei fue el primero en muchas cosas, aunque la lista exacta de sus hitos no forma parte de ese consenso. Y es que todos hemos estudiado a Xunei en algún momento de nuestra vida, pero no todos hemos estudiado al mismo Xunei. Por ejemplo, la versión que tuvieron que tragarse los migrantes en Taaku era especialmente empalagosa. ¿Qué recuerdo elegiría Xunei para sí mismo? Quizás la del coloso de bronce sobre la semiesfera, difícil decir que no a eso. Más cuando tu memoria ha sido usada para fines menos constructivos.


::: {.doc-box}
\begin{tcolorbox}[manifiestobox, breakable, title={}]
\docmeta{
\textbf{Fuente:} Panfleto de distribución pública.\\
\textbf{Tipo:} Manifiesto Noviembre Rosa\\
\textbf{Año:} 390 GC\\
\textbf{Contexto:} A finales del Siglo 4, los movimientos de reivindicación imperialista en Taaku empezaron a ganar fuerza explotando la imagen de Xunei Thun como símbolo de una época pasada y gloriosa.
}
\begin{adjustwidth}{3cm}{3cm}
No vamos a seguir tolerando la mentira y el robo diario del que somos objeto. Nos negamos a aceptar que alimañas que ni han sudado, ni llorado ni sangrado por nuestro lande se atrevan a criticar los logros de Taaku y a manchar su nombre. A difamar incluso el  nombre de Xunei Thun, orgullo y referente de la semiesfera entera. Los que dicen ser de Taaku por poseer un papel con un sello jamás entenderán qué significa llevar a Taaku en la sangre.\\

No nos engañemos, hermanos y hermanas. Los degenerados solo se volverán más valientes mientras no nos alcemos. No dejaremos de recibir patadas y bilis mientras respondamos con disculpas y muestras de sumisión. Debemos dar el paso de la historia, como hizo Xunei en su día, sobre la adversidad y mirando de frente a la historia. Con nuestra identidad y valores como estandarte. Con determinación y sin miramientos, por encima de todo lo que ose entrometerse en nuestro destino. Nuestra es la razón, y hasta hoy, nuestra ha sido la sangre vertida. Ya no más. A partir de hoy, el miedo cambia de bando.\\

¡Uníos a las demostraciones del orgullo de Taaku! El día de la Paz Rosa de este noviembre, saldremos a las calles y recuperaremos nuestras ciudades. Por la verdad, por el gran Taaku, y por el recuerdo sagrado de Xunei.
\end{adjustwidth}
\end{tcolorbox}
:::

Victimismo, deshumanización, landismo... ¿Dónde he visto esto yo antes? Ah sí, en casi todas las justificaciones de la violencia desde siempre. Pero seamos justos con Xunei. No debemos inculparlo porque su imagen haya sido usada durante siglos como elemento de manipulación de masas.\\
Sus actos en vida, eso ya sí sería cosa suya.

\clearpage
::: {.doc-box}
\begin{tcolorbox}[bandobox, unbreakable, title={}]
\docmeta{
\textbf{Fuente:} Museo Histórico de Deishe, Taaku.\\
\textbf{Tipo:} Bando del Administrador Real\\
\textbf{Año:} -11 GC\\
\textit{Contexto:} Emitido durante el mandato de Xunei, el bando público contenia información relevante para el día a día de la ciudadanía.\\
}
Por la autoridad que emana del Administrador de Deishe y de su eminente criterio, se publica el presente bando, para el cumplimiento y enriquecimiento de la población de Deishe:

\vspace{1em}
\begin{itemize}
\item[] \lettrine[lines=1, loversize=0.15, lraise=0.1]{\textbf{C}}{reación} del "Tributo de mejora de la seguridad y la limpieza de Deishe", aplicable a toda compraventa de Denenita dentro del límite jurisdiccional de Deishe, fijado en un 10\% sobre los beneficios generados.
\item[] \lettrine[lines=1, loversize=0.15, lraise=0.1]{\textbf{O}}{bligación} para todos los mercantes autorizados de reportar a la Oficina de Administración Real de manera trimestral, la cantidad de oblatos satisfecha por dicho tributo.
\item[] \lettrine[lines=1, loversize=0.15, lraise=0.1]{\textbf{D}}{ecreto} de priorización de los encargos públicos y de interés general sobre los privados y particulares, en el sector de las artes y los oficios. Incluidos los servicios de intendencia diaria requeridos para la operativa del Oficina de Administración Real y para las funciones de sus representantes.
\item[] \lettrine[lines=1, loversize=0.15, lraise=0.1]{\textbf{O}}{rden} de contratación pública para escultores de demostrado renombre, con un presupuesto de 8.000 Oblatos. Los individuos elegibles deben presentar candidatura en un periodo inferior a una semana en la Oficina de Administración Real.
\end{itemize}
\vspace{1em}
Distribúyase y sea satisfecho este bando, con efecto inmediato,\\
por orden del Administrador Real de Deishe\\
Xunei Thun
\end{tcolorbox}
:::
\clearpage


::: {.doc-box}
\begin{tcolorbox}[enciclopediabox, breakable, title={}]
\docmeta{
\textbf{Fuente:} Enciclopedia de Rocas y Minerales - 4a Edición revisada\\
\textbf{Año:} 878 GC\\
}

\begin{wrapfigure}{r}{0.33\textwidth}
  \includegraphics[width=\linewidth]{../../_Sources/imgs/denenita_full.jpg}
  \protect\caption*{Muestra de Denenita. A, B: Denenita en reposo. C: Denenita en los instantes posteriores a su fractura, mostrando la consiguiente respuesta exotérmica.}
\end{wrapfigure}

La Denenita es un nesosilicato compuesto por hierro y magnesio, rico en impurezas metálicas. Se caracteriza por una alta densidad de dislocaciones y puntos de tensión, lo que le aporta una gran capacidad de almacenamiento de energía, así como una frágil estabilidad estructural. En estado de reposo, el mineral presenta una conductividad térmica inusualmente baja. La Denenita se forma en condiciones de presión geostática extrema (superior a 3 GPa) y temperaturas moderadas (300-600 °C). La presión comprime y deforma la red cristalina de la Denenita, mientras evita que el hierro metálico se oxide, acumulando energía elástica y química. Tras su formación, la Denenita se encuentra en fase metaestable, siendo un mineral altamente volátil.

\vspace{1em}

\textbf{Comportamiento Mecánico-Térmico}

La Denenita produce una fuerte respuesta exotérmica al ser sometida a una tensión de cizalla que supere su límite elástico. En ese escenario de fractura, la red cristalina se reorganiza en una reacción en cadena de crecimiento exponencial, liberando energía elástica acompañada de un efecto pirofórico, causado por la oxidación violenta del hierro. El resultado es la liberación de una gran cantidad de energía térmica en un breve espacio de tiempo, acompañada de una descarga de fotones visibles. Tras este cambio de fase, la Denenita se transforma en un mineral estable e inerte.\\

\textbf{Usos de la Denenita}\\
Debido a la peligrosidad y inestabilidad del material (ver \textit{Destrucción del Túnel de Taaku-Yukar 82 GC}), la Denenita es actualmente un material de uso altamente restringido y sujeto a estrictos protocolos de seguridad. En el pasado, la Denenita fue un recurso fundamental para campos como la minería y la defensa.
\end{tcolorbox}
:::



\clearpage


::: {.doc-box}
\begin{tcolorbox}[edictobox, unbreakable, title={}]
\docmeta{
\textbf{Fuente:} Corte del Rey, Taaku.\\
\textbf{Tipo:} Edicto Real.\\
\textbf{Año:} -8 GC\\
\textit{Contexto:} La región cinturioniana de Yéiltk traducía todos los edictos reales de Taaku a la lengua regional (Yéilo), y los almacenaba en críptas subterráneas que han permitido su conservación.\\
}
En presencia de la virtud y autoridad del Trono de Taaku y de su soberano Kayaan Daak, Quinto Rey de Taaku, quien vela día y noche por el bien superior del lande, se hace público este edicto real, que \textbf{cesa de manera inmediata a Xunei Thun de sus funciones como Administrador Real de Deishe}, por traición manifiesta al pueblo de Taaku, quien no puede ni debe tolerar los siguientes hechos:
\begin{itemize}
\item Perjuicios y Malversación: Reducción de la recaudación de los impuestos del comercio de Denenita, con valores inferiores a los 500 Oblatos diarios, en coincidencia con un incremento impúdico de la asignación personal del Administrador.
\item Rebelión y Desacato: Insumisión explícita, manifestada en la escultura del Administrador Real de Deishe comisionada por él mismo, que supera en altura la escultura en honor al trono de Taaku, ubicada en el patio de recepciones de Deishe. 
\item Ofensas a la Corona: Difusión maliciosa de rumores falsos sobre el Rey, incluyendo la difusión de peyorativos ("Rey Codo", "el Codonarca de Taaku"), con el objetivo de ridiculizar y socavar la dignidad del trono.
\end{itemize} 

Por estos motivos, el Administrador Real de Deishe Xunei Thun queda depuesto de sus funciones de forma inmediata. Para resarcir a Taaku de sus ofensas, y demostrar su voluntad de servir al pueblo, mediante este mismo edicto y a su misma fecha, se nombra a Xunei Thun gestor de la mina-penal de Kalts'een.\\

\vspace{1em}
Todo lo anterior queda sellado por la palabra y voluntad suprema de Kayaan Daak, soberano Rey de Taaku.
\end{tcolorbox}
:::


\timelinefooter{../../_Sources/imgs/xunei_time/time3.png}


\clearpage

\begin{figure}\centering \vspace{-10pt} \includegraphics[width=.9\linewidth]{../../_Sources/imgs/codo/final_elbow.jpeg}
\caption*{\textit{"Sin título"}, obra original del siglo 1. A la derecha, una imagen con infrarrojos realizada durante su restauración muestra un repinte posterior sobre el original. Posible representación del "Rey Codo". Colección privada.}
  \vspace{-10pt}
\end{figure}


 A lo largo de una década en el cargo, Xunei alcanzó excepcionales cotas de corrupción y egolatría, llegando a niveles considerados como escandalosos para una monarca absolutista. Logros que le valieron una caída en desgracia que debió ser el tema favorito de las conversaciones de la corte durante meses. El gestor de una de las principales fuentes de riqueza del lande y amigo personal del Rey, desterrado como supervisor de condenados a trabajos forzados. A tres mil metros de altura, en eterna sequía y constante estado de congelación. Habitado únicamente por soldados y criminales, y en mayor proporción, por soldados criminales. Donde nadie está por voluntad propia. Donde no se duerme tranquilo. Sin duda, Xunei no encontró allí nada que quisiera conocer, y aún así logró sobrevivir varios años. Un hecho que, debió causar enorme frustración en las casas de apuestas de la capital.

\clearpage


::: {.doc-box}
\begin{tcolorbox}[manualbox, breakable, title={}]
\docmeta{
\textbf{Fuente:} Celda-mina de Kalts'een, Taaku\\
\textbf{Tipo:} Manual de gestión\\
\textbf{Año:} -37 GC\\
\textbf{Contexto:} Circular de procedimientos autorizados en la operativa de la mina celda - Kalts'een
}
\begin{itemize}
\item Seguridad y gestión de riesgo: 
	\begin{itemize}
	\item  La mina-celda alberga principalmente a criminales convictos y individuos violentos. Es imperativo extremar la cautela en todas las interacciones directas, que deben evitarse siempre que sea posible.
	\item  La fortificación de Kalts'een no es una localización valorada por la tropa, y se usa como destino punitivo. Abundan historiales de faltas graves y insubordinación. Se debe priorizar la seguridad personal en todas las interacciones con soldados y oficiales.
	\item La sequía y bajas temperaturas de la zona resultan en una constante escasez de recursos naturales. La desesperación en la población local puede causar episodios de comportamiento inestable y extremo.
	\item De manera generalizada, se desaconseja efusivamente cualquier muestra de confraternidad en el enclave, ya sea con la tropa, con los locales o con los reclusos. 
	\end{itemize}
\item  Operativa efectiva de la mina-celda:
	\begin{itemize}
	\item  Solo existe una entrada/salida de la mina-celda, rodeada por la fortaleza militar. Cualquier otra apertura a la sumontaña está prohibida bajo pena de muerte.
	\item Según los Acuerdos de Reforma Penal Minera, está prohibido el acceso al interior de una mina-celda para todo oficial de Taaku.
	\item  La mina-celda fue concebida para su autogestión. Los presos son responsables de su administración. Los oficiales de Taaku deben abstenerse de intervenir en los asuntos internos de la mina-celda.
	\item  El reconocimiento del Gremio de Mineros como interlocutor fue formalizado en los Acuerdos de Reforma Penal Minera. Cualquier comunicación con el interior de la mina-celda debe ser realizada a través del Gremio y quedar registrada en el diario oficial.
	\item El conflicto con el Gremio debe ser minimizado con el fin de evitar cualquier tipo de interrupción en la cadena de producción de Denenita.
	\item  La cuota semanal de Denenita está prefijada y debe ser satisfecha de manera precisa y puntual. El protocolo de entrega debe ser ejecutado como está detallado en el Anexo 1 de este documento. Cualquier desviación en este sentido debe ser notificada de manera inmediata a la corte de Taaku.
	\end{itemize}
\end{itemize}

\textbf{}
\end{tcolorbox}

\begin{tcolorbox}[manualbox, breakable, title={}]
\textbf{Anexo 4: Registro de bajas de suboficiales y rangos superiores en Kalts'een}
\begin{itemize}
\item Suboficial Inez Sorkanui: apuñalado
\item Suboficial Yuve Tak'olashi: desaparecida
\item Oficial Dorven P'assek: envenenado
\item Suboficial Miveth Oskashi: apuñalado
\item Oficial Reshan Dorun: caída por la ventana
\item Administrador Ryntta Ossuk: envenenada
\item Oficial Vaan Ikasho: decapitado
\item Suboficial Enka Ovaran: apuñalada
\item Administrador Darven K'esso: envenenada
\item Administrador Ren Osk'a: desaparecido
\item Suboficial Meshu Karn: ahogado
\item Suboficial Shyyn Vaktu: apuñalada en el baño
\item Oficial Yol Bree'm: caída por las escaleras y apuñalado
\item Suboficial Ipaa Yup'ool: apuñalado mientras dormía, en la cara
\end{itemize}
\end{tcolorbox}
:::



::: {.doc-box}
\begin{tcolorbox}[kaltsbox, unbreakable, title={}]
\docmeta{
\textbf{Fuente:} Correspondencia personal de la familia Lihashi\\
\textbf{Tipo:} Cartas manuscritas \\
\textbf{Año:} -7 a -1 GC\\
\textbf{Contexto:} Correspondencia escrita y enviada por Xunei Thun desde Kalts'een al asesor legal de su familia, Ran Lihashi, durante sus años como Administrador de la mina-celda de Kalts'een.\\
}
\texttt{Carta fechada en el año -7 GC. Extractos seleccionados.}\\
\begin{adjustwidth}{2cm}{2cm}
Apreciado Consejero Lihashi,\\
Le escribo desde la mina-celda de Kalts'een, como Administrador de la misma por decreto real. He decidido que sea usted la primera persona que reciba mi correspondencia personal, en reconocimiento a su trayectoria como valedor de mis intereses y los de mi familia. Estoy convencido de que merece el privilegio que esta misiva supone y que sabrá gestionar el prestigio que le otorga.

Antes de nada, quisiera tranquilizar la inquietud que le atenaza a usted y a todo aquel que me es cercano. Le puedo asegurar que me encuentro con entereza de espíritu. Decidido a afrontar sin ambages el reto que me ha sido encomendado, inédito en su dificultad. Me posee el mismo ánimo que llevó a nuestro querido Rey a imponerme esta pesada carga, pues solo al súbdito más capaz y leal se le puede asignar el desafío más inconmensurable. Al más antiguo de sus amigos, afortunado guardián de su tierna y preciosa infancia. El amor de nuestro Rey es tanto mi condena como mi honor. Pienso justificar la confianza puesta en mí, alzarme sobre los ruines y los indignos, sobrevivir al peso de la sumontaña sin fin, y volver triunfal a la corte de Etaan, a ocupar el espacio que merezco junto al favor del Rey.

Sin duda, extirpar la innobleza y la pereza de la mina-celda requerirá de todos mis esfuerzos. No podré pues ocuparme de la gestión de mis asuntos y bienes, y por ello requiero, estimado Ran, sus valiosos servicios. El confinamiento en Kalts'een no me permitirá acceder a mis activos, y cuando regrese querré disfrutar de los réditos que estos hayan generado. Tenga a bien enviarme información actualizada sobre su estado con frecuencia.

Antes de despedirme, quisiera pedirle un favor, en honor a los años de colaboración que nos preceden. Siempre que pueda, recuerde al entorno del Rey que su fiel súbdito Xunei Thun sigue trabajando para él desde Kalts'een, cada día, cada hora.

Sin más, quedo a la espera de sus noticias.\\
Atentamente,\\
Xunei Thun
\end{adjustwidth}
\end{tcolorbox}

\begin{tcolorbox}[kaltsbox, unbreakable, title={}]
\texttt{Carta fechada en el año -6 GC. Extractos seleccionados.}\\
\begin{adjustwidth}{2cm}{2cm}
... semejante infamia es inconcebible. Que estando yo sirviendo a Taaku desde este miserable lugar, se pisotee el buen nombre de la familia Thun no puede ser tolerado. El Edicto Real no imponía el embargo de mis bienes, lo cual sería una medida injusta y un escarnio que el Rey jamás aceptaría. Le conmino a iniciar, de manera inmediata, cualquier acción legal necesaria para revertir esta injusticia. No permitiré que mi patrimonio sea saqueado mientras yo me sacrifico por la gloria de Taaku y de nuestro Rey.\\

Apenas tengo tiempo de preocuparme de otra cosa que no sea educar a la tropa local. Salvajes y carniceros, soldados solo en el uniforme. Deberían estar a mis órdenes y servicio, pero apenas logro que me hagan de escolta sin tener que tolerar burlas y peores actos de indisciplina de los que le ahorraré los detalles. Compartir su mismo destino es un insulto que sufro a diario. Aún no he conocido a ningún recluso-minero, pero dudo que sean peores que sus custodios.\\

Mi recuerdo debe llegar a oídos del Rey. Estimado amigo y consejero, debe exponer mis penurias y sacrificios en la corte con la mayor vehemencia de la que sea capaz. Sé que puedo confiar en usted para esta empresa, de la cual depende mi vida y mi futuro....
\end{adjustwidth}
\end{tcolorbox}

\begin{tcolorbox}[kaltsbox, unbreakable, title={}]
\texttt{Carta fechada en el año -4 GC.  Extractos seleccionados.}\\
\begin{adjustwidth}{2cm}{2cm}
... Ran, haz el favor de revisar tu ruta de correo. No recibo tus cartas, y necesito que me hagas llegar algunos oblatos. Sácalo de cualquiera de mis fuentes...
\end{adjustwidth}
\end{tcolorbox}

\begin{tcolorbox}[kaltsbox, unbreakable, title={}]
\texttt{Carta fechada en el año -1 GC.  Extractos seleccionados.}\\
\begin{adjustwidth}{3cm}{3cm}
... no sé por qué sigo escribiendo. quizás mi último vínculo con la cordura. me aferro a ella no recuerdo porque. solo me acompaña el frío y la soledad. los de hoy y los de mañana. ya no espero noticias de nadie. solo espero el silencio. no habrá justicia para mi. amaneceré envenenado. acuchillado. muerto. peor estar para siempre contigo, sin llegar jamás a ver tu cima ...
\end{adjustwidth}
\end{tcolorbox}
:::


Este es, sin duda, su momento más bajo. Cuando ya extendía los brazos para abrazar el olvido. Y este es, también, el momento en el que cae del cielo y sobre sus manos abiertas, un regalo inconcebible, cortesía de la Denenita.





\newpage
::: {.doc-box}
\begin{tcolorbox}[actabox, breakable, title={}]
\docmeta{
\textbf{Fuente:} Registro de actas y eventos mineros, volumen AAA372\\
\textbf{Tipo:} Transcipción de reunión\\
\textbf{Año:} 0 GC\\
\textbf{Contexto:} El gremio generaba actas de sus reuniones de gestión,  copiando y distribuyendo los registros. \\
}
Consejo minero de Kalts'een - Sesión extraordinaria\\
Fecha: Día 36 ciclo 46.\\
Asistentes:
\begin{itemize}
\item Amo de Cepa de Kalts'een 
\item Bravucón de Segunda, cepa de acceso 2A
\item Bravucón de Segunda, cepa de acceso 5
\item Bravucón de Segunda, cepa de acceso 7
\item Bravucón de Ramal, 749
\end{itemize}

Orden del día:
\begin{enumerate}
\item Descripción del incidente de perforación en el ramal 749. 
\item Escritos en Piedra
\end{enumerate}

1/ Transcripción textual del testimonio del minero 72ufur, jefe de tallo del incidente:\\
\begin{adjustwidth}{2.5cm}{2cm}
"La cuadrilla era como cualquier otra. Ocho operando el tallo a rotación. Íbamos cortos de luz, solo tres Athabas para toda la galería, pero el ritmo de avance era bueno. El más novato era un segunda generación. Se nota cuando todo el mundo sabe lo que tiene que hacer y nadie se queja.\\

La primera señal fue el ruido. Llevábamos tres horas con la música del tallo. El siseo térmico y el golpe de pico que indica que la galería avanza. Ese ritmo que no tiene principio, ni final, ni nada que lo interrumpa, y que indica que todo va bien. Y de repente, donde venía el segundo pico, ... nada. Un silencio inmóvil y vacío.\\

Miro a 39ohfa que en ese momento de la rotación era el segundo pico y lo veo ido. Su mirada sin pestañeo clavada en la roca. Y entonces lo veo. Motas de polvo flotando en un hilo de luz brillante que sale de la pared que estamos trabajando. Como un alfiler blanco que brota de la roca. ¡Luz! Lo imposible. Nadie dice nada. No lo entiendo. Pienso que un error de trayectoria ha hecho que dos ramales colisionen, pero sé que es mentira. \\

39ohfa es el primero en reaccionar. Se adelanta y golpea la fuente de luz con rabia. El sol se derrama inmediatamente por toda la galería, cegándonos a todos. Una luz pura y dolorosa que ahoga el brillo verdoso de las Athabas. Cuando se me acostumbró la vista me asomé al agujero. Al otro lado hay un frío que roba el alma. Llevo dos ciclos sin salir de la mina, pero estoy completamente seguro de que aquello no es Taaku. Ni siquiera parece Kalts'een, todo blanco."\\
\end{adjustwidth}
2/ Este consejo acuerda los siguientes Escritos en Piedra:
\begin{itemize}
\item Ha sucedido la construcción del primer túnel bajo una sumontaña.
\item Las sumontañas tienen fin. La teoría de la todomontaña queda refutada.
\item El gremio y los mineros deben adaptar cómo interactuamos con el resto del lande, dónde y cómo construimos minas, a esta nueva realidad.
\item Se ignora lo que hay al otro lado del umbral. Sea lo que sea, los mineros no tienen interés en ello. Tanto si es Taaku como si no, el Rey tendrá interés en ello. El gremio debe usar esta realidad para avanzar en su objetivo fundacional de autonomía y recursos para los mineros.
\end{itemize}
3/ Se mandatan los siguientes estudios:
\begin{itemize}
	\item Términos de soberanía y servicio del túnel. 
	\item Plan de notificación a los representantes del Rey.
	\item Propuesta de ruta y ajustes de seguridad.
\end{itemize}

Firmado y sellado, \\
Consejo minero de Kalts'een
\end{tcolorbox}
:::

\newpage

\begin{figure} \centering 
\includegraphics[width=0.5\linewidth]{../../_Sources/Maps/interlande_map.png}
  \protect\caption*{Mapa del lande de Taaku.}
\end{figure}

Xunei ya no enviaba cartas. Dedicaba sus días a preguntarse si tendría tiempo de volverse loco antes de morir, y poco más. Una pregunta que es tanto un drama personal como su propia respuesta. Y en estas andaba cuando un soldado cualquiera llamó a su puerta, para informarle que el Gremio le quería contar una historia fantástica. Al otro lado de la puerta, podemos imaginar a un Xunei poseído por la soledad y la paranoia. Pidiéndole a la sumontaña que baje la voz, mientras abre. ¿Qué esperar de alguien así, puesto al frente del mayor descubrimiento de la historia de la semiesfera? Un triple salto mortal sobre el vacío desconocido e implacable. 

\clearpage

::: {.doc-box}
\begin{tcolorbox}[cartareybox, breakable, title={}]
\docmeta{
\textbf{Fuente:} Correspondencia de la Corte del Rey, Etaan\\
\textbf{Tipo:} Carta Manuscrita\\
\textbf{Año:} 0 GC\\
\textbf{Contexto:} El gestor de la mina-celda Xunei Thun envió una carta al Rey de Taaku, notificandole el suceso. El correo tardó unos 20 días en realizar el viaje entre Kalts'een y la corte.}
\begin{adjustwidth}{2cm}{2cm}
Soberano y Señor, amado Rey de Taaku,\\

mi más querido amigo. Hoy y siempre a tu servicio, igual que el primer día.\\

El trabajo en Kalts'een es arduo, pero del fruto de mi persistencia y esfuerzo ha emergido el éxito. Debo notificarle que hemos excavado un túnel a través de Kalts'een. La sumontaña tiene fin. Existe el otro lado. \\

Esta es la más maravillosa de las noticias. Su majestad se convertirá en el primer Rey de Taaku en expandir los límites de su dominio. Felicidades por su merecido éxito histórico.\\

Mi mayor preocupación ahora mismo es el estado de los mineros. Se sienten asustados y confusos. Amenazan con sepultar el acceso al túnel por miedo a lo que pueda haber al otro lado. Ruegan que una expedición real entre en la mina para asegurar "el otro lado del umbral". Me veo obligado a acceder.  Lo haré con el beneplácito que sé que su majestad me otorga, llevando conmigo a un grupo de valientes soldados de Taaku, para defender codo con codo la seguridad de todo el lande y los intereses de la corona.\\

Le enviaré información detallada de lo que allí encuentre a nuestra vuelta.\\

Siempre leal a Taaku, a su Rey, y a su amigo \\

Xunei Thun\\
Gestor de la Mina-Celda de Kalts'een.
\end{adjustwidth}
\end{tcolorbox}
:::

Casi toda la mitología de Xunei Thun surge de esta carta, interpretada durante siglos sin ningún contexto adicional. Según cuenta la leyenda, años más tarde el Rey Kayaan Daak (para entonces ya primer Emperador de Taaku) ordenó inmortalizar la misiva en una placa de Denenita con incrustaciones de oro. Aunque ese artefacto no se conserva, el Museo de Historia Real de Etaan sí que posee una extensa colección de traducciones y reproducciones de la carta. Curiosamente, los textos relativos a la vida anterior de Xunei nunca tuvieron tanta difusión por parte de los diferentes gobernantes de Taaku. Tampoco de los eventos que siguieron a esta carta. Hasta que se descifró y publicó el Diario de Shteek.


::: {.doc-box}
\begin{tcolorbox}[diariobox, unbreakable, title={}]
\docmeta{
\textbf{Fuente:} Fortaleza de Kalts'een, Taaku.\\
\textbf{Tipo:} Diario personal \\
\textbf{Año:} 0 GC\\
\textbf{Contexto:} Shteek era el notario penal de Kalts'een, responsable de alzar las actas referentes a la operativa de la mina-celda. Participó en la primera incursión a través del túnel, y sus notas de la expedición fueron descubiertas en una de las excavaciones arqueológicas realizadas cerca de la mina-celda de Kalts'een.
}
\begin{adjustwidth}{2cm}{2cm}
Los presos me han prohibido tomar notas de la mina. La débil luz de sus hongos luminiscentes tampoco permite ver gran cosa, hasta que llegamos ante el umbral. Una ventana del tamaño de una persona, que muestra al otro lado un mundo blanco e intacto. Xunei habla a los soldados: "Vais a entrar para siempre en la historia de Taaku. Vuestro nombre será escrito, cantado y recordado durante milenios.  Vuestra recompensa, legendaria y merecida". Los soldados se ven felices. Xunei es el primero en cruzar.
\end{adjustwidth}
\end{tcolorbox}

\begin{tcolorbox}[diariobox, unbreakable, title={}]
\begin{adjustwidth}{2cm}{2cm}
Nos detenemos a descansar. Nunca imaginé que caminar por la nieve pudiera cansar tanto. Tengo los pies empapados y fríos. No me siento los dedos. Seguimos la pared de roca en dirección oeste, evitamos adentrarnos en el bosque blanco que lo ocupa todo. Los árboles tienen unas hojas duras y fibrosas en forma de flecha. No comestibles. Varios soldados tiritan sin control.
\end{adjustwidth}
\end{tcolorbox}

\begin{tcolorbox}[diariobox, unbreakable, title={}]
\begin{adjustwidth}{2cm}{2cm}
Detenidos tras quejas de la tropa. Caminamos siempre hacia el oeste. El sol se ha movido más rápido de lo que debería, y no nos quedan muchas horas de luz. He visto un par de aves cruzar el cielo. Hay vida animal. Una silueta parecida al Águila Azul que habita el este de Taaku. El gestor ordena adentrarse en el bosque para refugiarnos del viento que sopla cada vez más fuerte. Los soldados protestan.
\end{adjustwidth}
\end{tcolorbox}

\begin{tcolorbox}[diariobox, unbreakable, title={}]
\begin{adjustwidth}{2cm}{2cm}
Llevan un rato maldiciendo y apenas han logrado cortar unas pocas ramas. Esta madera es muy flexible y no arde. Bajo la espesa capa de nieve encontramos un entramado compacto de raíces y ramas. Recojo una muestra. No tenemos hoguera y ya oscurece.
\end{adjustwidth}
\end{tcolorbox}

\begin{tcolorbox}[diariobox, unbreakable, title={}]
\begin{adjustwidth}{3cm}{2.5cm}
huimos del bosque tras llevarse a xunei. somos cuatro en un saliente de piedra. no sabemos donde esta el resto. es nuestra última antorcha. intentaremos llegar a la mina cuando salga el sol
\end{adjustwidth}
\end{tcolorbox}

\begin{tcolorbox}[diariobox, unbreakable, title={}]
\begin{adjustwidth}{1cm}{1cm}
Escribo esto de vuelta a nuestra amada Taaku. El gestor de la mina-celda, ocho soldados y yo mismo cruzamos el umbral. Cuatro regresamos a Taaku. Lo que pasó en el bosque me persigue. Anoto lo que recuerdo en este diario antes de que mi memoria cambie. Tras fracasar en hacer una hoguera, Xunei ordena a los soldados cavar un gran agujero en la nieve para no tener que dormir sobre mojado. Los soldados pierden la compostura en masa. Se profieren gritos, insultos y amenazas. Xunei retrocede y se sube a una gran roca. Desenvaina su espada hacia el cielo nocturno. Habla de esa hoja de acero, regalo del Rey de Taaku, que representa la voluntad inquebrantable de todo nuestro lande. Grita que la historia nos está observando, esperando a que revelemos de qué estamos hechos. Dice algo más que no recuerdo, porque una sombra blanca emerge de la oscuridad y lo aplasta de un salto. Solo oímos sus huesos crujir. Es una bestia grande como un hombre, de pelaje blanco, terribles dientes y ojos negros, que exprime al gestor de Kalts'een contra la nieve. Una rápida dentellada al cuello de Xunei, y la sangre brota roja sobre blanco. La criatura nos mira con sus orejas, se gira y desaparece silenciosa entre los árboles, llevándose a Xunei. Nadie dice nada, hasta que todos empiezan a gritar y correr. Yo también, siguiendo a la mayoría.\\

Esto es lo que relataré al emisario del Rey que se acerca a Kalts'een. Espero no tener que volver a ver jamás aquel lugar.
\end{adjustwidth}
\end{tcolorbox}
:::


Menudo final para el primer interlande. ¿O quizás fue el segundo interlande? O el tercero, o el cuarto. A saber. Muy probablemente el primer interlande fue algún minero anónimo suficientemente curioso como para cruzar el umbral. Eso sí, nadie podrá quitarle a Xunei el derecho a ostentar un título igualmente singular: el del primer interlande devorado por un animal salvaje. Qué menos que reconocerle ese mérito.

\clearpage

\begin{figure}[h]\centering \includegraphics[width=0.75\linewidth]{../../_Sources/imgs/predator/predator7.jpeg}
\caption{Ilustración zoográfica del Pandilubi. Geonaturaleza de Yukar, 2a Edición.}
\end{figure}



::: {.doc-box}
\begin{tcolorbox}[audioguidebox, title={}]
\docmeta{
	\textbf{Fuente:} Museo Xunei Thun de Arte, Taaku.\\ \textbf{Tipo:} Audioguía para visitantes\\
	\textbf{Año:} 480 GC 
}
\dline{Bob}{Qué triste me pone siempre llegar a esta sala. No solo porque sea la última de la visita (¡Con lo bien que nos lo estamos pasando!), también porque está dedicada a los últimos años de la vida de Xunei.}
\dline{Ann}{La verdad es que poco se sabe de esa época. Tras la gran conexión solo hay un par de comunicados oficiales que mencionan el liderazgo de Xunei en los primeros contactos con los Yukaris. Pero nada realmente sólido hasta el funeral de estado del 2 GC.}
\dline{Bob}{Fíjate en la pared del fondo. El cuadro "El Adiós de Thun" siempre me apretuja el alma. Es una composición preciosa. La multitud que fluye como un río desde el horizonte para despedir a quien les marcó el sendero a recorrer, en el centro, el propio rey, arrodillado y roto frente a los restos de Xunei, y en el fondo, sus familiares con velo. De todo el cuadro, ellos son los únicos que mantienen la compostura, representando la ejemplaridad y rectitud del Thun. El detalle escondido pero no menor, del individuo que graba el lema "Primer Ciudadano del Imperio de Taaku" en la columna del mausoleo, título que le fue otorgado de manera póstuma.}
\dline{Ann}{Magnífico sin duda. Este cuadro fue pintado más de doscientos años tras la muerte de Xunei, e incluye algunas inconsistencias menores. Lo que es completamente verídico son las ofertas de la tienda de regalos del museo. Por cada compra de una camiseta, un llavero gratis. No dejéis pasar esta oportunidad única. Una vez hayan podido apreciar las obras de esta sala, por favor salgan a través de la tienda para dar por finalizada esta visita. ¡Gracias por venir y vuelvan pronto!}
\end{tcolorbox}
:::

Esta sería, así rápido y por encima, la historia de la historia de Xunei Thun. Nacido en la cima y derrotado por su propia incompetencia. Víctima de un depredador ya extinto. Herramienta de desaprensivos y fanáticos. Musa de los creativos del marketing, y literalmente\footnote{figuradamente}, ingrediente perfecto de un anuncio de comida instantánea.


\begin{figure}[h!]\centering \includegraphics[width=0.55\linewidth]{../../_Sources/imgs/xunei_coin/coin.jpeg}
\caption{Oblato de Taaku del siglo 3. Fuente: Museo Xunei Thun de Arte, Taaku.}
\end{figure}


{\centering \textbf{FIN}}

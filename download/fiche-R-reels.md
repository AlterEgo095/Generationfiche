# FICHE PÉDAGOGIQUE — L'Ensemble R des réels

**FICHE N°** : 19  
**BRANCHE** : Mathématiques  
**SUJET DE LA RÉVISION** : SUJET DE LA RÉVISION : Les élèves doivent maîtriser les notions sur les ensembles de nombres N, Z, D et Q.  
**SUJET DU JOUR** : L'Ensemble R des réels  
**MATÉRIEL DIDACTIQUE** : MATÉRIEL DIDACTIQUE : Tableau blanc, craies, projecteur et affiches illustrant différentes représentations des nombres réels.  
**/REF. BGP** : /REF. BGP : Mathématiques 3e secondaire, Programme national d'enseignement, édition Mamba.  

**OBJECTIFS OPÉRATIONNELS** : OBJECTIFS OPÉRATIONNELS : À la fin de la leçon, les élèves seront capables de définir l'ensemble R et de distinguer les nombres réels des autres ensembles numériques.

**À L'ISSUE DE CETTE LEÇON, L'ÉLÈVE SERA CAPABLE DE (D')** :
- ▲ COMPÉTENCES : Définir
- ▲ Classer
- ▲ Représenter

---

## I. INTRODUCTION

**a) Rappel** : RAPPEL : Nous avons étudié les ensembles de nombres naturels N (entiers positifs), entiers relatifs Z (natures et leurs opposés), décimaux D (nombres à virgule finie) et rationnels Q (fractions). Ces ensembles sont inclus les dans les autres selon N ⊂ Z ⊂ D ⊂ Q. Les nombres irrationnels comme √2 ou π ne peuvent pas s'écrire sous forme de fraction.

**b) Motivation** : MOTIVATION : Comment mesurer précisément la diagonale d'un carré de côté 1 ? Comment représenter des grandeurs comme la température ou le temps qui peuvent prendre n'importe quelle valeur ?

**c) Annonce du sujet** : ANNONCE DU SUJET : Aujourd'hui, nous allons découvrir l'ensemble des nombres réels R qui regroupe tous les nombres, rationnels et irrationnels.

## II. DÉVELOPPEMENT

# DÉVELOPPEMENT DE LA LEÇON : L'ENSEMBLE R DES RÉELS

## 1. Définition de R (ensemble des réels)

**Définition :** L'ensemble $\mathbb{R}$ des nombres réels est l'ensemble de tous les nombres qui peuvent être représentés sur une droite numérique. Il comprend les nombres rationnels et les nombres irrationnels.

Un nombre réel est un nombre qui peut être exprimé avec une décimale finie ou infinie périodique (rationnel) ou infinie non périodique (irrationnel).

## 2. Notation et représentation sur la droite numérique

**Notation :** On note $\mathbb{R}$ l'ensemble des nombres réels.

**Représentation :** La droite numérique est une droite sur laquelle on a choisi un point origine O (correspondant à 0), une unité de longueur et un sens positif (généralement de gauche à droite). Chaque point de la droite numérique correspond à un nombre réel et inversement.

```
<---|-----|-----|-----|-----|-----|-----|-----|-----|-----|--->
    -3    -2    -1     0     1     2     3     4     5
```

## 3. Inclusion des ensembles

Nous avons les inclusions suivantes :
$$\mathbb{N} \subset \mathbb{Z} \subset \mathbb{D} \subset \mathbb{Q} \subset \mathbb{R}$$

Où :
- $\mathbb{N}$ : ensemble des nombres naturels $\{0, 1, 2, 3, ...\}$
- $\mathbb{Z}$ : ensemble des nombres entiers $\{..., -2, -1, 0, 1, 2, ...\}$
- $\mathbb{D}$ : ensemble des nombres décimaux (nombres à développement décimal fini)
- $\mathbb{Q}$ : ensemble des nombres rationnels (fractions d'entiers $\frac{p}{q}$ où $p \in \mathbb{Z}$ et $q \in \mathbb{Z}^*$)

## 4. Rationnels vs irrationnels

**Nombres rationnels :** Ce sont les nombres qui peuvent s'écrire sous forme de fraction $\frac{p}{q}$ où $p \in \mathbb{Z}$ et $q \in \mathbb{Z}^*$.

Exemples : $\frac{1}{2}$, $-\frac{3}{4}$, $5 = \frac{5}{1}$, $0.25 = \frac{1}{4}$, $0.\overline{3} = \frac{1}{3}$

**Nombres irrationnels :** Ce sont les nombres réels qui ne peuvent pas s'écrire sous forme de fraction de deux entiers. Ils ont un développement décimal infini et non périodique.

Exemples :
- $\sqrt{2} \approx 1,414213562...$ (irrationnel, car on ne peut pas l'écrire comme fraction de deux entiers)
- $\pi \approx 3,141592653...$ (irrationnel)
- $e \approx 2,718281828...$ (irrationnel, base du logarithme naturel)

**Preuve que $\sqrt{2}$ est irrationnel :**
Supposons que $\sqrt{2}$ est rationnel, alors $\sqrt{2} = \frac{p}{q}$ avec $p$ et $q$ premiers entre eux.
Alors $2 = \frac{p^2}{q^2}$, donc $p^2 = 2q^2$.
Cela implique que $p^2$ est pair, donc $p$ est pair.
Posons $p = 2k$, alors $(2k)^2 = 2q^2$, soit $4k^2 = 2q^2$, donc $q^2 = 2k^2$.
Ainsi $q^2$ est pair, donc $q$ est pair.
Cela contredit l'hypothèse que $p$ et $q$ sont premiers entre eux.
Donc $\sqrt{2}$ est irrationnel.

## 5. Intervalles de R

Les intervalles sont des sous-ensembles de $\mathbb{R}$ définis par des bornes.

**Notations :**
- $[a, b] = \{x \in \mathbb{R} | a \leq x \leq b\}$ (intervalle fermé)
- $]a, b[ = \{x \in \mathbb{R} | a < x < b\}$ (intervalle ouvert)
- $[a, b[ = \{x \in \mathbb{R} | a \leq x < b\}$ (intervalle semi-ouvert à droite)
- $]a, b] = \{x \in \mathbb{R} | a < x \leq b\}$ (intervalle semi-ouvert à gauche)

**Intervalles illimités :**
- $[a, +\infty[ = \{x \in \mathbb{R} | x \geq a\}$
- $]a, +\infty[ = \{x \in \mathbb{R} | x > a\}$
- $]-\infty, a] = \{x \in \mathbb{R} | x \leq a\}$
- $]-\infty, a[ = \{x \in \mathbb{R} | x < a\}$
- $]-\infty, +\infty[ = \mathbb{R}$ (tout l'ensemble des réels)

## 6. Propriétés des opérations dans R

**Propriétés commutatives :**
- Pour tout $a, b \in \mathbb{R}$ : $a + b = b + a$
- Pour tout $a, b \in \mathbb{R}$ : $a \times b = b \times a$

**Propriétés associatives :**
- Pour tout $a, b, c \in \mathbb{R}$ : $(a + b) + c = a + (b + c)$
- Pour tout $a, b, c \in \mathbb{R}$ : $(a \times b) \times c = a \times (b \times c)$

**Propriétés distributives :**
- Pour tout $a, b, c \in \mathbb{R}$ : $a \times (b + c) = a \times b + a \times c$

**Éléments neutres :

## III. SYNTHÈSE

SYTHÈSE: L'ensemble R des nombres réels comprend tous les nombres rationnels et irrationnels, représentés sur la droite numérique. Les réels peuvent être positifs, négatifs ou nuls, et s'étendent des nombres entiers aux fractions et aux nombres comme π ou √2. Cet ensemble est continu et illimité, permettant de représenter toutes les mesures physiques.

## IV. APPLICATION

1. Placer les nombres -3, π/2, √5 et
2. 7 sur une droite numérique graduée.
3. Déterminer si chaque nombre est rationnel ou irrationnel: a)

## V. AUTO-ÉVALUATION

1. □ Quelle est la différence entre un nombre rationnel et un nombre irrationnel?
2. □ Comment représente-t-on graphiquement l'ensemble des solutions d'une inéquation du premier degré?
3. □ Pourquoi l'ensemble R est-il-il considéré comme continu?

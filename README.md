# Catch a Thief

## Context

A little fucker decided to commit a burglary in my building and steal some valuables from the apartment of my cousin. We managed to retrieve the CCTV footage of the building (2 video streams), according to regulations and the approval of the landlords. I was tasked to isolate faces and timestamps of the visitors to try and catch the thief.

A few problems:
- The burglary was committed over a 2-week period, without any way of knowing when it started or ended.
- There are 2 video streams to analyze.
- The total file size is more than 640 GB.
- The entrances are used by at least 3 buildings of 15 floors. On top of that, a private school is located inside. On top of that, most of these buildings are under renovation, so many entrances are always open and workers are coming and going all the time.

Realistically, I don't see how I could find the thief among thousands of faces to compare, but what makes this burglary unique is that only one apartment was targeted and it almost never happened before, according to the janitor. The door was reinforced and only a few small (but valuable) items were stolen.

My cousin's theory is that he knows the thief, because:
- Only one apartment was targeted.
- The thief knew he was away from home for a while.
- The thief knew what to steal.

I am personally more inclined to believe it was a worker, because:
- Breaking an armored door is no easy task. Police said this particular one was fairly easy to break into, but even knowing that requires skills and knowledge.
- A lot of renovation work is being done (ventilation, insulation, etc.), so lately we've had many workers coming and going inside apartments.
- My cousin might have let the thief know, without realizing it, that he would be away for studies.

For these reasons, I will try to:
- Identify every face in the video streams, hoping that my cousin might recognize someone.
- Find suspicious behavior like unusual movements, eye-contact with CCTV cameras, etc.
- Target people who used the odd-numbered elevator, since the crime was committed on the 9th floor — but even then, the thief (or thieves) could have thought of that and used the stairs or the even-numbered elevator.
- Look for events at night, though workers have the advantage of knowing the location and could act in broad daylight.

It's quite a lot of work that the police would not do, and if they did, they wouldn't give me back my 1 TB SSD, which is a fucking disgrace. But anyway, let's get to work!

## Approach

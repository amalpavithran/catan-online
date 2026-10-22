import {it,expect} from 'vitest';
import {cueFor} from '../audio';
it('maps game outcomes to distinct audio without playing for ordinary syncs',()=>{
 for(const [text,cue] of [['rolls 7.','roll'],['builds a road.','build'],['trades 4 brick for 1 ore.','trade'],['moves the robber.','robber'],['steals a resource from Bob.','steal'],['buys a development card.','card'],['takes their turn.','turn'],['wins the game with 10 victory points!','win'],['discards 2 ore.','discard'],['collects 1 ore.',null]])expect(cueFor(text!)).toBe(cue);
});

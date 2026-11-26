import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {portGroves,portWoodland,type WoodlandGround} from './portWoodland';

const ground: WoodlandGround = {
  heightAt:(x,z)=>4+.05*x-.025*z,
  nearRoad:(x,z)=>Math.abs(z-x*.13+18)<2,
  paintUnderTree:()=>{},
};

test('groves consistently follow rendered ground and leave roads and neighbours clear',()=>{
  const established={x:-26,y:3,z:-13,s:1.5};
  const trees=portGroves(ground,[established]);
  assert.ok(trees.length>20);
  assert.deepEqual(trees,portGroves(ground,[established]));
  for(let i=0;i<trees.length;i++) {
    const tree=trees[i];
    assert.equal(tree.y,ground.heightAt(tree.x,tree.z));
    assert.equal(ground.nearRoad(tree.x,tree.z),false);
    for(const other of [established,...trees.slice(0,i)])
      assert.ok(Math.hypot(tree.x-other.x,tree.z-other.z)>=1.55*(tree.s+other.s));
  }
  assert.deepEqual(portGroves({...ground,nearRoad:()=>true},[]),[]);
});

test('3D crowns replace the distant representation only below the detail height and after loading', t=>{
  let onLoad:(texture:THREE.Texture)=>void = ()=>assert.fail('missing foliage texture');
  t.mock.method(THREE.TextureLoader.prototype,'load',(url:string,ready?:(texture:THREE.Texture)=>void)=>{
    if(url.endsWith('galaz-portowa.webp') && ready) onLoad=ready;
    return new THREE.Texture();
  });
  const trees=portGroves(ground,[]);
  const grove=portWoodland(trees,ground);
  try {
    assert.equal(grove.update(5,2,1,0,0),false);
    onLoad(new THREE.Texture());
    assert.equal(grove.update(5,2,1,0,0),true);
    assert.equal(grove.group.children.length,6);
    let crowns=0;
    for(const part of grove.group.children) {
      assert.ok(part instanceof THREE.InstancedMesh);
      assert.ok(Number.isFinite(part.boundingSphere?.radius));
      if(part.customDepthMaterial) crowns+=part.count;
    }
    assert.equal(crowns,trees.length);
    assert.equal(grove.update(48,5,2,0,0),false);
    assert.equal(grove.update(47,5,2,0,0),true);
  } finally { grove.dispose(); }
});

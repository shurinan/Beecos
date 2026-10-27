import json, sys
def q(s): return "'" + s.replace("'", "''") + "'"
def arr(a): return "ARRAY[" + ",".join(q(x) for x in a) + "]::text[]" if a else "'{}'::text[]"
def seed(rows):
    out=[]
    sectors={}; profs={}
    for r in rows:
        sectors.setdefault(r["sector_slug"],(r["sector"],r["sector_sort"]))
        profs.setdefault(r["profession_slug"],(r["sector_slug"],r["profession"],r["profession_aliases"],r["profession_sort"]))
    out.append("INSERT INTO public.sectors (slug, name, sort) VALUES\n" + ",\n".join(f"  ({q(k)}, {q(n)}, {s})" for k,(n,s) in sectors.items()) +
      "\nON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, sort = EXCLUDED.sort;")
    out.append("INSERT INTO public.professions (sector_id, slug, name, aliases, sort)\nSELECT s.id, v.slug, v.name, v.aliases, v.sort FROM (VALUES\n" +
      ",\n".join(f"  ({q(ss)}, {q(k)}, {q(n)}, {arr(a)}, {so})" for k,(ss,n,a,so) in profs.items()) +
      "\n) AS v(sector_slug, slug, name, aliases, sort) JOIN public.sectors s ON s.slug = v.sector_slug\nON CONFLICT (slug) DO UPDATE SET sector_id = EXCLUDED.sector_id, name = EXCLUDED.name, aliases = EXCLUDED.aliases, sort = EXCLUDED.sort;")
    out.append("INSERT INTO public.services (profession_id, slug, name, aliases, sort, active)\nSELECT p.id, v.slug, v.name, v.aliases, v.sort, v.active FROM (VALUES\n" +
      ",\n".join(f"  ({q(r['profession_slug'])}, {q(r['service_slug'])}, {q(r['service'])}, {arr(r['service_aliases'])}, {r['service_sort']}, {'true' if r['active'] else 'false'})" for r in rows) +
      "\n) AS v(profession_slug, slug, name, aliases, sort, active) JOIN public.professions p ON p.slug = v.profession_slug\nON CONFLICT (profession_id, slug) DO UPDATE SET name = EXCLUDED.name, aliases = EXCLUDED.aliases, sort = EXCLUDED.sort, active = EXCLUDED.active;")
    return "\n\n".join(out)+"\n"
if __name__=="__main__":
    print(seed(json.load(open(sys.argv[1]))))
